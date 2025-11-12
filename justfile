

[doc("Send simple markdown text to stdin")]
@test:
  echo -ne "" | bun run public/main.bundle.js
