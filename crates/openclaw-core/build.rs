// napi-build generates the C entrypoint that Node.js uses to load this addon.
extern crate napi_build;

fn main() {
    napi_build::setup();
}
