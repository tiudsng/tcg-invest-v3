const fs = require('fs');
let c = fs.readFileSync('./src/ProductDetail.tsx', 'utf-8');

c = c.replace(/\$\{\(product as any\)\.description && \(/g, '{(product as any).description && (');

// Let's replace width template literals
c = c.replace(/width: `\$\{product\.investment_metrics\?\.growth_potential \|\| \(100 - \(product\.rank \|\| 0\) \* 5\)\}%`/g, 'width: `${product.investment_metrics?.growth_potential || (100 - (product.rank || 0) * 5)}%`');
c = c.replace(/width: `\$\{product\.investment_metrics\?\.holding_score \|\| 85\}%`/g, 'width: `${product.investment_metrics?.holding_score || 85}%`');
c = c.replace(/`「\$\{product\.analysis_quote\}」`/g, '`「${product.analysis_quote}」`');
c = c.replace(/`「\$\{product\.name_zh\} 作為 \$\{product\.set_name\} 的明星卡牌/g, '`「${product.name_zh} 作為 ${product.set_name} 的明星卡牌');
c = c.replace(/navigate\(`\/\?search=\$\{encodeURIComponent\(product\.name_zh\)\}`\)/g, 'navigate(`/?search=${encodeURIComponent(product.name_zh)}`)');
fs.writeFileSync('./src/ProductDetail.tsx', c);
