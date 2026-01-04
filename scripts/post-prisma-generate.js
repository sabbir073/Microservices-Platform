const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "../src/generated/prisma/index.ts");
const indexContent = `// Re-export everything from client for barrel import support
export * from "./client";
`;

fs.writeFileSync(indexPath, indexContent);
console.log("Created prisma index.ts for barrel exports");
