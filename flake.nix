{
  description = "agent-gwt workspace dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfreePredicate = pkg:
            builtins.elem (pkgs.lib.getName pkg) [ "github-copilot-cli" ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.pnpm
            pkgs.github-copilot-cli
          ];
          shellHook = ''
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
          '';
        };
      });
}
