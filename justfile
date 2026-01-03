[doc("Send simple markdown text to stdin, required build before running")]
[group("tests")]
@simple-test:
  echo -ne "# hello" | bun run public/main.bundle.js

[doc("Send simple markdown text to stdin, required build before running")]
[group("tests")]
@test:
  bun run scripts/test_stdin.js | bun run public/main.bundle.js


