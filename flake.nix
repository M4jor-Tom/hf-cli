{
  description = "hf-cli — generate images with the Anima V1 Hugging Face Space";

  inputs = {
    replay_right.url = "github:M4jor-Tom/replay_right";
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
        cp ${./rename_image.sh} "$out/rename_image.sh"
        cp ${./identify_image.sh} "$out/identify_image.sh"
        patchShebangs "$out/"*.sh
        printf '%s\n' '{"type":"module"}' > "$out/package.json"
      '';
      automationApp = headless: replay_right.lib.mkApp {
        inherit pkgs headless;
        cookiesDir = "./cookies";
        script = "${taskBundle}/task.ts";
      };
      baseApp = automationApp true;
      headedApp = automationApp false;
      signupUrl = "https://huggingface.co/join";
      joinApp = pkgs.writeShellApplication {
        name = "hf-cli-join";
        text = ''
          exec ${replay_right.apps.${system}.browser.program} "$@" "${signupUrl}"
        '';
      };
      app = pkgs.writeShellApplication {
        name = "hf-image-generation";
        runtimeInputs = [ pythonEnv pkgs.coreutils pkgs.gitMinimal pkgs.util-linux ];
        text = ''
          usage() {
            echo "usage: nix run .#default -- [--headed] [--browser firefox <profile-name>] [--download-dir <path>] [--count N | -n N] <request.json>" >&2
            exit 2
          }
          headed=0
          count=1
          browser_args=()
          download_dir="$HOME/Downloads"
          while [ "$#" -gt 0 ]; do
            case "$1" in
              --headed) headed=1; shift ;;
              --count|-n)
                [ "$#" -ge 2 ] && [[ "$2" =~ ^[1-9][0-9]*$ ]] || usage
                count="$2"
                shift 2 ;;
              --browser)
                [ "$#" -ge 3 ] || usage
                browser_args=("$1" "$2" "$3")
                shift 3 ;;
              --download-dir)
                [ "$#" -ge 2 ] && [ -n "$2" ] || usage
                download_dir="$2"
                shift 2 ;;
              --) shift; break ;;
              -*) usage ;;
              *) break ;;
            esac
          done
          [ "$#" -eq 1 ] || usage
          input="$(realpath -- "$1")"
          python3 ${./validate-request.py} ${./generation.schema.json} "$input"
          export HF_CLI_INPUT="$input" HF_CLI_DOWNLOAD_DIR="$download_dir" HF_CLI_COUNT="$count"
          runner=${baseApp.program}
          if [ "$headed" -eq 1 ]; then runner=${headedApp.program}; fi
          exec "$runner" "''${browser_args[@]}"
        '';
      };
    in {
      apps.${system} = {
        default = { type = "app"; program = "${app}/bin/hf-image-generation"; };
        join = { type = "app"; program = "${joinApp}/bin/hf-cli-join"; };
      };

      checks.${system} = {
        request-validation = pkgs.runCommand "hf-cli-request-validation" {
          nativeBuildInputs = [ pythonEnv ];
        } ''
          python3 ${./tests/test-request-validation.py} ${./validate-request.py} ${./generation.schema.json} ${./generation.example.json}
          touch "$out"
        '';

        save-download = pkgs.runCommand "hf-cli-save-download" {
          nativeBuildInputs = [ pkgs.nodejs_22 pkgs.gitMinimal pkgs.util-linux ];
        } ''
          node ${self}/tests/test-save-download.mjs
          touch "$out"
        '';

        task-package = pkgs.runCommand "hf-cli-task-package" {
          nativeBuildInputs = [ pkgs.nodejs_22 ];
        } ''
          HF_CLI_TASK_PATH=${taskBundle}/task.ts node --experimental-strip-types --test ${./tests/test-task-package.mjs}
          touch "$out"
        '';

        browser-options = pkgs.runCommand "hf-cli-browser-options" {
          nativeBuildInputs = [ pkgs.nodejs_22 ];
        } ''
          node ${./tests/test-browser-options.mjs} ${joinApp}/bin/hf-cli-join ${app}/bin/hf-image-generation ${./generation.example.json}
          touch "$out"
        '';
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = [ pythonEnv pkgs.nodejs_22 ];
      };
    };
}
