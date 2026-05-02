const fs = require('fs');
let c = fs.readFileSync('./src/ProductDetail.tsx', 'utf-8');

c = c.replace(/\$\{\(product as any\)\.description && \(/g, '{(product as any).description && (');

// Replace standard ES6 template strings
c = c.replace(/`\$\\\{product\.investment_metrics\?\.growth_potential \|\| \(100 \- \(product\.rank \|\| 0\) \* 5\)\}\%`/g, '`${product.investment_metrics?.growth_potential || (100 - (product.rank || 0) * 5)}%`');
c = c.replace(/`\$\\\{product\.investment_metrics\?\.holding_score \|\| 85\}\%`/g, '`${product.investment_metrics?.holding_score || 85}%`');
c = c.replace(/`「\$\\\{product\.analysis_quote\\\}」`/g, '`「${product.analysis_quote}」`');
c = c.replace(/`「\$\\\{product\.name_zh\\\} 作為 \$\\\{product\.set_name\\\} 的明星卡牌/g, '`「${product.name_zh} 作為 ${product.set_name} 的明星卡牌');
c = c.replace(/`\/\?search=\$\\\{encodeURIComponent\(product\.name_zh\)\\\}`/g, '`/?search=${encodeURIComponent(product.name_zh)}`');
// Wait, my initial literal export exported:
// style={{ width: \`\$\{product.investment_metrics?.growth_potential || (100 - (product.rank || 0) * 5)\}%\` }} 
// Wait! In the script that I used base64, I had:
// style={{ width: \`\$\{product.investment_metrics?.growth_potential || (100 - (product.rank || 0) * 5)\}%\` }}
// Which means the file has `\$\{` exactly as text!
c = c.replace(/\\\$\\\{/g, '${');

fs.writeFileSync('./src/ProductDetail.tsx', c);
