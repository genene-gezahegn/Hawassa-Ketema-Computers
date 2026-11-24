import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { pool } from './db.js';
const source=await readFile(new URL('../../src/lib/inventory.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const module=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
try{
 for(const p of module.defaultInventory){
  await pool.query(`INSERT INTO products(legacy_id,sku,name,brand,model,category,description,specs,price,stock_quantity,reorder_level,product_photo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(sku) DO UPDATE SET name=EXCLUDED.name,brand=EXCLUDED.brand,model=EXCLUDED.model,category=EXCLUDED.category,description=EXCLUDED.description,specs=EXCLUDED.specs,price=EXCLUDED.price,stock_quantity=EXCLUDED.stock_quantity,reorder_level=EXCLUDED.reorder_level,product_photo=EXCLUDED.product_photo,updated_at=NOW()`,[p.id,p.sku,p.name,p.brand||'',p.model||'',p.category||'Accessories',p.notes||'',p.specs||'',p.price,p.stockQuantity,p.lowStockThreshold??5,p.productPhoto||null]);
 }
 console.log(`Imported ${module.defaultInventory.length} existing sample products into PostgreSQL.`);
}catch(e){console.error('Product import failed:',e.message);process.exitCode=1;}finally{await pool.end();}
