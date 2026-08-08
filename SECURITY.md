# Security policy

## Supported versions

Security fixes target the latest release and the default branch. This is a pet
project; older binaries do not receive backports.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or exposed
credential. Use GitHub's private security advisory form for this repository, or
contact the repository owner privately through their GitHub profile. Include a
minimal reproduction, affected version and impact, but never include a real API
key or personal job-search data.

## Credential model

- User-provided AI credentials are stored in Windows Credential Manager.
- Optional release demo credentials are compiled into the desktop binary and
  must be treated as publicly extractable. Only rate-limited, free-tier,
  billing-disabled projects are acceptable for that purpose.
- Pull-request workflows do not receive release environment secrets.
- `.env`, private keys, databases and generated catalog archives are ignored by
  Git and must remain untracked.

Official release assets include `SHA256SUMS.txt`. Windows installers are not yet
code-signed, so users should verify the checksum before running a download.
