import { randomBytes, scrypt as nodeScrypt } from "node:crypto";

const N = 32_768;
const r = 8;
const p = 1;
const keyLength = 64;

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      keyLength,
      { N, r, p, maxmem: 96 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    return new Promise((resolve) => {
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        input += chunk;
      });
      process.stdin.on("end", () => resolve(input.replace(/[\r\n]+$/, "")));
    });
  }

  return new Promise((resolve, reject) => {
    let input = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function finish() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      resolve(input);
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdout.write("\n");
          reject(new Error("Operação cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        input += character;
        process.stdout.write("•");
      }
    }

    process.stdin.on("data", onData);
  });
}

try {
  const password = await readHidden("Senha administrativa: ");
  if (password.length < 12) {
    throw new Error("Use uma senha com pelo menos 12 caracteres.");
  }
  if (password.length > 512) {
    throw new Error("Use uma senha com no máximo 512 caracteres.");
  }
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    const confirmation = await readHidden("Repita a senha: ");
    if (confirmation !== password) {
      throw new Error("As senhas informadas não coincidem.");
    }
  }

  const salt = randomBytes(16);
  const key = await derive(password, salt);
  console.log(
    ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("."),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Não foi possível gerar o hash.");
  process.exitCode = 1;
}
