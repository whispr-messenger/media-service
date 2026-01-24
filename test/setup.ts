// Patch pour Jest + Node.js : injecte global.crypto si absent
if (!global.crypto) {
  global.crypto = require('crypto');
}
