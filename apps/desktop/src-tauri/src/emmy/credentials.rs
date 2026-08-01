use zeroize::Zeroizing;

use super::contracts::{EmmyConfiguration, EmmyProvider, EmmyProviderConfiguration, LlmError};

include!(concat!(env!("OUT_DIR"), "/demo_keys.rs"));

pub(crate) trait CredentialSource: Send + Sync {
    fn key_for(&self, provider: EmmyProvider) -> Result<Option<Zeroizing<String>>, LlmError>;
    fn configuration(&self) -> Result<EmmyConfiguration, LlmError>;
}

#[derive(Clone, Default)]
pub(crate) struct CredentialManager;

impl CredentialManager {
    pub(crate) fn set_byok(&self, provider: EmmyProvider, key: &str) -> Result<(), LlmError> {
        platform::write(provider, key)
    }

    pub(crate) fn clear_byok(&self, provider: EmmyProvider) -> Result<(), LlmError> {
        platform::delete(provider)
    }

    pub(crate) fn configuration(&self) -> Result<EmmyConfiguration, LlmError> {
        <Self as CredentialSource>::configuration(self)
    }

    fn byok(&self, provider: EmmyProvider) -> Result<Option<Zeroizing<String>>, LlmError> {
        platform::read(provider)
    }

    fn demo(provider: EmmyProvider) -> Option<Zeroizing<String>> {
        let provider_index = EmmyProvider::ALL
            .iter()
            .position(|candidate| *candidate == provider)?;
        let encoded = DEMO_KEYS
            .iter()
            .find_map(|(name, bytes)| (*name == provider.as_str()).then_some(*bytes))?;
        if encoded.is_empty() {
            return None;
        }
        let decoded = Zeroizing::new(
            encoded
                .iter()
                .enumerate()
                .map(|(index, byte)| {
                    let mask = 0x5a_u8
                        .wrapping_add((provider_index as u8).wrapping_mul(29))
                        .wrapping_add((index as u8).wrapping_mul(17));
                    byte ^ mask
                })
                .collect::<Vec<_>>(),
        );
        std::str::from_utf8(decoded.as_slice())
            .ok()
            .map(|value| Zeroizing::new(value.to_owned()))
    }
}

impl CredentialSource for CredentialManager {
    fn key_for(&self, provider: EmmyProvider) -> Result<Option<Zeroizing<String>>, LlmError> {
        if let Some(byok) = self.byok(provider)? {
            return Ok(Some(byok));
        }
        Ok(Self::demo(provider))
    }

    fn configuration(&self) -> Result<EmmyConfiguration, LlmError> {
        let providers = EmmyProvider::ALL
            .into_iter()
            .map(|provider| {
                let byok_configured = self.byok(provider)?.is_some();
                let demo_available = Self::demo(provider).is_some();
                Ok(EmmyProviderConfiguration {
                    provider,
                    configured: byok_configured || demo_available,
                    byok_configured,
                    demo_available,
                })
            })
            .collect::<Result<Vec<_>, LlmError>>()?;
        Ok(EmmyConfiguration {
            available: providers.iter().any(|provider| provider.configured),
            providers,
        })
    }
}

#[cfg(windows)]
mod platform {
    use std::{ffi::c_void, ptr};

    use windows_sys::Win32::{
        Foundation::{GetLastError, ERROR_NOT_FOUND},
        Security::Credentials::{
            CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
            CRED_TYPE_GENERIC,
        },
    };
    use zeroize::Zeroizing;

    use super::{EmmyProvider, LlmError};

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }

    fn target(provider: EmmyProvider) -> Vec<u16> {
        wide(&format!("GiveMeJob!/Emmy/{}", provider.as_str()))
    }

    pub(super) fn write(provider: EmmyProvider, key: &str) -> Result<(), LlmError> {
        let mut target_name = target(provider);
        write_target(&mut target_name, key)
    }

    fn write_target(target_name: &mut [u16], key: &str) -> Result<(), LlmError> {
        let mut username = wide("GiveMeJob!");
        let blob_size = u32::try_from(key.len()).map_err(|_| LlmError::InvalidRequest)?;
        let credential = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: target_name.as_mut_ptr(),
            CredentialBlobSize: blob_size,
            CredentialBlob: key.as_bytes().as_ptr().cast_mut(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            UserName: username.as_mut_ptr(),
            ..CREDENTIALW::default()
        };
        // SAFETY: all pointers reference live buffers for the duration of CredWriteW;
        // Credential Manager copies the generic credential before returning.
        let written = unsafe { CredWriteW(&credential, 0) };
        if written == 0 {
            Err(LlmError::Local)
        } else {
            Ok(())
        }
    }

    pub(super) fn read(provider: EmmyProvider) -> Result<Option<Zeroizing<String>>, LlmError> {
        let target_name = target(provider);
        read_target(&target_name)
    }

    fn read_target(target_name: &[u16]) -> Result<Option<Zeroizing<String>>, LlmError> {
        let mut raw: *mut CREDENTIALW = ptr::null_mut();
        // SAFETY: target_name is null-terminated and raw is a valid out pointer.
        let read = unsafe { CredReadW(target_name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) };
        if read == 0 {
            // SAFETY: GetLastError is read immediately after the failed Win32 call.
            return if unsafe { GetLastError() } == ERROR_NOT_FOUND {
                Ok(None)
            } else {
                Err(LlmError::Local)
            };
        }
        if raw.is_null() {
            return Err(LlmError::Local);
        }

        // SAFETY: CredReadW returned one allocated CREDENTIALW block. Its blob is valid
        // until CredFree; bytes are copied before the guard is dropped.
        let bytes = Zeroizing::new(unsafe {
            let credential = &*raw;
            if credential.CredentialBlob.is_null() || credential.CredentialBlobSize == 0 {
                Vec::new()
            } else {
                std::slice::from_raw_parts(
                    credential.CredentialBlob,
                    credential.CredentialBlobSize as usize,
                )
                .to_vec()
            }
        });
        // SAFETY: the credential block remains owned by this function. Clear the
        // provider key in the Win32 temporary allocation before releasing it once.
        unsafe {
            let credential = &mut *raw;
            if !credential.CredentialBlob.is_null() && credential.CredentialBlobSize > 0 {
                ptr::write_bytes(
                    credential.CredentialBlob,
                    0,
                    credential.CredentialBlobSize as usize,
                );
            }
            CredFree(raw.cast::<c_void>());
        }

        if bytes.is_empty() {
            return Ok(None);
        }
        std::str::from_utf8(bytes.as_slice())
            .map(|value| Zeroizing::new(value.to_owned()))
            .map(Some)
            .map_err(|_| LlmError::Local)
    }

    pub(super) fn delete(provider: EmmyProvider) -> Result<(), LlmError> {
        let target_name = target(provider);
        delete_target(&target_name)
    }

    fn delete_target(target_name: &[u16]) -> Result<(), LlmError> {
        // SAFETY: target_name is a live null-terminated UTF-16 buffer.
        let deleted = unsafe { CredDeleteW(target_name.as_ptr(), CRED_TYPE_GENERIC, 0) };
        if deleted != 0 {
            return Ok(());
        }
        // SAFETY: GetLastError is read immediately after the failed Win32 call.
        if unsafe { GetLastError() } == ERROR_NOT_FOUND {
            Ok(())
        } else {
            Err(LlmError::Local)
        }
    }

    #[cfg(test)]
    mod tests {
        use std::time::{SystemTime, UNIX_EPOCH};

        use super::{delete_target, read_target, wide, write_target};

        struct Cleanup(Vec<u16>);

        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = delete_target(&self.0);
            }
        }

        #[test]
        fn credential_manager_round_trip_uses_an_isolated_target() {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            let mut cleanup = Cleanup(wide(&format!(
                "GiveMeJob!/Emmy/Test/{}/{nonce}",
                std::process::id()
            )));
            let sentinel = "m4-credential-manager-smoke";

            write_target(&mut cleanup.0, sentinel).expect("test credential should write");
            let loaded = read_target(&cleanup.0)
                .expect("test credential should read")
                .expect("test credential should exist");
            assert_eq!(loaded.as_str(), sentinel);
            drop(loaded);
            delete_target(&cleanup.0).expect("test credential should delete");
            assert_eq!(
                read_target(&cleanup.0).expect("deleted target should remain readable"),
                None
            );
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use zeroize::Zeroizing;

    use super::{EmmyProvider, LlmError};

    pub(super) fn write(_provider: EmmyProvider, _key: &str) -> Result<(), LlmError> {
        Err(LlmError::Unavailable)
    }

    pub(super) fn read(_provider: EmmyProvider) -> Result<Option<Zeroizing<String>>, LlmError> {
        Ok(None)
    }

    pub(super) fn delete(_provider: EmmyProvider) -> Result<(), LlmError> {
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests_support {
    use std::{collections::HashMap, sync::Mutex};

    use zeroize::Zeroizing;

    use super::{
        CredentialSource, EmmyConfiguration, EmmyProvider, EmmyProviderConfiguration, LlmError,
    };

    #[derive(Default)]
    pub(crate) struct FakeCredentials {
        keys: Mutex<HashMap<EmmyProvider, String>>,
    }

    impl FakeCredentials {
        pub(crate) fn configured() -> Self {
            Self {
                keys: Mutex::new(HashMap::from([
                    (EmmyProvider::Groq, "fake-groq-key".to_owned()),
                    (EmmyProvider::Gemini, "fake-gemini-key".to_owned()),
                    (EmmyProvider::Openrouter, "fake-openrouter-key".to_owned()),
                    (EmmyProvider::Cerebras, "fake-cerebras-key".to_owned()),
                ])),
            }
        }
    }

    impl CredentialSource for FakeCredentials {
        fn key_for(&self, provider: EmmyProvider) -> Result<Option<Zeroizing<String>>, LlmError> {
            let keys = self.keys.lock().map_err(|_| LlmError::Local)?;
            Ok(keys.get(&provider).cloned().map(Zeroizing::new))
        }

        fn configuration(&self) -> Result<EmmyConfiguration, LlmError> {
            let keys = self.keys.lock().map_err(|_| LlmError::Local)?;
            let providers = EmmyProvider::ALL
                .into_iter()
                .map(|provider| EmmyProviderConfiguration {
                    provider,
                    configured: keys.contains_key(&provider),
                    byok_configured: keys.contains_key(&provider),
                    demo_available: false,
                })
                .collect::<Vec<_>>();
            Ok(EmmyConfiguration {
                available: providers.iter().any(|provider| provider.configured),
                providers,
            })
        }
    }
}
