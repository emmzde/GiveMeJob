fn main() {
    match givemejob_desktop_lib::run_m2_benchmark_cli() {
        Ok(true) => {}
        Ok(false) => std::process::exit(2),
        Err(error) => {
            eprintln!("M2 benchmark failed: {error}");
            std::process::exit(1);
        }
    }
}
