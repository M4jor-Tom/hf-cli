{
  description = "hf-cli — generate images with the Anima V1 Hugging Face Space";

  inputs = {
    replay_right.url = "path:/home/theta/repos/replay_right";
    nixpkgs.follows = "replay_right/nixpkgs";
  };

  outputs = { self, replay_right, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      pythonEnv = pkgs.python3.withPackages (p: [ p.jsonschema ]);
      taskBundle = pkgs.runCommand "hf-cli-task" { } ''
        mkdir -p "$out"
        cp ${./task.ts} "$out/task.ts"
        cp ${./save-download.mjs} "$out/save-download.mjs"
        printf '%s\n' '{"type":"module"}' > "$out/package.json"
      '';
      baseApp = replay_right.lib.mkApp {
        inherit pkgs;
        cookiesDir = "./cookies";
        script = "${taskBundle}/task.ts";
      };
      app = pkgs.writeShellApplication {
        name = "hf-image-generation";
        runtimeInputs = [ pythonEnv pkgs.coreutils ];
        text = ''
          if [ "$#" -ne 1 ]; then
            echo "usage: nix run .#default -- <request.json>" >&2
            exit 2
          fi
          input="$(realpath -- "$1")"
          python3 ${./validate-request.py} ${./generation.schema.json} "$input"
          export HF_CLI_INPUT="$input"
          exec ${baseApp.program}
        '';
      };
    in {
      apps.${system} = {
        default = { type = "app"; program = "${app}/bin/hf-image-generation"; };
        browser = replay_right.apps.${system}.browser;
      };

      checks.${system} = {
        request-validation = pkgs.runCommand "hf-cli-request-validation" {
          nativeBuildInputs = [ pythonEnv ];
        } ''
          python3 ${./tests/test-request-validation.py} ${./validate-request.py} ${./generation.schema.json} ${./generation.example.json}
          touch "$out"
        '';

        task-package = pkgs.runCommand "hf-cli-task-package" {
          nativeBuildInputs = [ pkgs.nodejs_22 ];
        } ''
          HF_CLI_TASK_PATH=${taskBundle}/task.ts node --experimental-strip-types --test ${./tests/test-task-package.mjs}
          touch "$out"
        '';
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = [ pythonEnv pkgs.nodejs_22 ];
      };
    };
}
