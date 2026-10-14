import { webcrypto, randomBytes } from "node:crypto";
const password=process.argv[2];if(!password){console.error('Usage: node tools/hash-password.mjs "YourStrongPassword"');process.exit(1)}
const enc=new TextEncoder(),salt=randomBytes(16);const key=await webcrypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await webcrypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256);const b64=b=>Buffer.from(b).toString("base64url");console.log(JSON.stringify({salt:b64(salt),passwordHash:b64(bits),iterations:210000},null,2));
