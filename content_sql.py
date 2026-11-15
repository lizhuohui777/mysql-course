"""Short authored SQL tasks, with expected values generated from each trusted fixture."""
import sqlite3

PRODUCTS = {'name':'products','columns':['id','name','price','stock'],
            'rows':[[1,'水',3,10],[2,'面包',5,6],[3,'牛奶',8,0],[4,'水',4,2]]}
ORDERS = {'name':'orders','columns':['id','product_id','quantity'],
          'rows':[[101,1,2],[102,1,1],[103,2,1]]}
CHECK = 'SELECT id, name, price, stock FROM products ORDER BY id;'

# Each tuple is one sentence, one hint, and one editable statement.
TASKS = {
3:[
('查price不超过5且stock大于5的name。','用AND连接两个条件。','SELECT name FROM products WHERE price <= 5 AND stock > 5;'),
('查名称是水或面包的id、name。','同列两种等值条件用OR连接。',"SELECT id, name FROM products WHERE name = '水' OR name = '面包';"),
('查stock未知的id、name。','未知是NULL，用IS NULL。','SELECT id, name FROM products WHERE stock IS NULL;'),
('查不是水且stock非NULL的name。','NOT否定名称条件，再用AND检查IS NOT NULL。',"SELECT name FROM products WHERE NOT (name = '水') AND stock IS NOT NULL;")],
4:[
('查id、name，按price从低到高排列。','用ORDER BY price ASC。','SELECT id, name FROM products ORDER BY price ASC;',{'ordered':True}),
('查最贵两件商品的name、price。','ORDER BY price DESC，再LIMIT 2。','SELECT name, price FROM products ORDER BY price DESC, id ASC LIMIT 2;',{'ordered':True}),
('查不重复的name。','把DISTINCT放在name前面。','SELECT DISTINCT name FROM products;'),
('查id最大的商品id、name。','按id降序，只取一行。','SELECT id, name FROM products ORDER BY id DESC LIMIT 1;',{'ordered':True})],
5:[
('查名称以水开头的id、name。','LIKE的%匹配任意长度后缀。',"SELECT id, name FROM products WHERE name LIKE '水%';"),
('查id为1或3的id、name。','用IN (1, 3)。','SELECT id, name FROM products WHERE id IN (1, 3);'),
('查price在3到5之间的name、price。','BETWEEN包含两端。','SELECT name, price FROM products WHERE price BETWEEN 3 AND 5;'),
('查stock在0到2之间的id、stock。','两端0和2也要算。','SELECT id, stock FROM products WHERE stock BETWEEN 0 AND 2;')],
6:[
('同时统计总行数与stock非NULL的行数。','COUNT(*)数行，COUNT(stock)只数stock非NULL。','SELECT COUNT(*) AS total, COUNT(stock) AS known_stock FROM products;'),
('查price的最小值和最大值。','SELECT中用逗号分开MIN、MAX。','SELECT MIN(price), MAX(price) FROM products;'),
('查库存合计和价格平均值。','SUM(stock)与AVG(price)。','SELECT SUM(stock), AVG(price) FROM products;'),
('统计stock大于0的商品行数。','先用WHERE筛选，再COUNT(*)。','SELECT COUNT(*) FROM products WHERE stock > 0;')],
7:[
('确认已准备的库存修改。','写一条COMMIT提交。','COMMIT;',{'operation':'COMMIT','setup':'BEGIN;\nUPDATE products SET stock = 8 WHERE id = 1;','check':CHECK}),
('撤销已准备的库存修改。','写ROLLBACK，观察库存回到初始值。','ROLLBACK;',{'operation':'ROLLBACK','setup':'BEGIN;\nUPDATE products SET stock = 8 WHERE id = 1;','check':CHECK}),
('把id为2的stock改为7，由预设COMMIT提交。','只写带WHERE的UPDATE；事务边界已准备。','UPDATE products SET stock = 7 WHERE id = 2;',{'operation':'UPDATE','setup':'BEGIN;','after':'COMMIT;','check':CHECK,'affected':1}),
('把id为1的stock改为8，再观察预设ROLLBACK。','写UPDATE即可；撤销后整表应恢复初始状态。','UPDATE products SET stock = 8 WHERE id = 1;',{'operation':'UPDATE','setup':'BEGIN;','after':'ROLLBACK;','check':CHECK,'affected':1})],
8:[
('按name统计每个名称的商品行数。','SELECT name, COUNT(*)，然后GROUP BY name。','SELECT name, COUNT(*) AS total FROM products GROUP BY name;'),
('按name计算price平均值。','将COUNT换成AVG(price)。','SELECT name, AVG(price) AS avg_price FROM products GROUP BY name;'),
('只保留行数大于1的name及行数。','分组后用HAVING COUNT(*) > 1。','SELECT name, COUNT(*) AS total FROM products GROUP BY name HAVING COUNT(*) > 1;'),
('对price不超过5的商品，按name汇总stock。','WHERE先筛行，再GROUP BY与SUM。','SELECT name, SUM(stock) AS total_stock FROM products WHERE price <= 5 GROUP BY name;')],
9:[
('查每条订单的order_id和商品name。','orders别名o，products别名p；按product_id=id配对。','SELECT o.id AS order_id, p.name FROM orders AS o INNER JOIN products AS p ON o.product_id = p.id;'),
('查订单101的商品name和quantity。','连接后用WHERE o.id = 101。','SELECT p.name, o.quantity FROM orders AS o INNER JOIN products AS p ON o.product_id = p.id WHERE o.id = 101;'),
('查quantity大于1的order_id和商品name。','用o.quantity > 1筛选连接结果。','SELECT o.id AS order_id, p.name FROM orders AS o INNER JOIN products AS p ON o.product_id = p.id WHERE o.quantity > 1;'),
('查所有水订单的order_id和quantity。','筛选p.name；两个订单都要保留。',"SELECT o.id AS order_id, o.quantity FROM orders AS o INNER JOIN products AS p ON o.product_id = p.id WHERE p.name = '水';")],
10:[
('保留全部商品，查p.id和对应order_id。','products放左侧；同一商品两条订单要输出两次。','SELECT p.id, o.id AS order_id FROM products AS p LEFT JOIN orders AS o ON p.id = o.product_id;'),
('查没有订单的商品id、name。','LEFT JOIN后检查o.id IS NULL。','SELECT p.id, p.name FROM products AS p LEFT JOIN orders AS o ON p.id = o.product_id WHERE o.id IS NULL;'),
('查id为3的name和order_id，仍保留无订单商品。','LEFT JOIN后只用p.id筛左行。','SELECT p.name, o.id AS order_id FROM products AS p LEFT JOIN orders AS o ON p.id = o.product_id WHERE p.id = 3;'),
('保留所有商品，只匹配quantity大于1的订单，查p.id、order_id。','把o.quantity > 1放在ON中，而不是WHERE。','SELECT p.id, o.id AS order_id FROM products AS p LEFT JOIN orders AS o ON p.id = o.product_id AND o.quantity > 1;')],
11:[
('合并id为1、2的name和id为4的name，保留重复。','两段SELECT之间用UNION ALL。','SELECT name FROM products WHERE id IN (1, 2) UNION ALL SELECT name FROM products WHERE id = 4;'),
('同样合并两段name，但去除重复。','把UNION ALL换为UNION。','SELECT name FROM products WHERE id IN (1, 2) UNION SELECT name FROM products WHERE id = 4;'),
('从available_products查id、name。','视图已创建，直接SELECT指定两列。','SELECT id, name FROM available_products;'),
('从available_products查stock大于5的name、stock。','对视图再用WHERE筛选。','SELECT name, stock FROM available_products WHERE stock > 5;')],
12:[
('查price高于全表平均价的name、price。','括号内用SELECT AVG(price)。','SELECT name, price FROM products WHERE price > (SELECT AVG(price) FROM products);'),
('查有订单的商品id、name，每件商品一行。','EXISTS中用o.product_id = p.id。','SELECT p.id, p.name FROM products AS p WHERE EXISTS (SELECT 1 FROM orders AS o WHERE o.product_id = p.id);'),
('查没有订单的商品id、name。','将存在性条件改为NOT EXISTS。','SELECT p.id, p.name FROM products AS p WHERE NOT EXISTS (SELECT 1 FROM orders AS o WHERE o.product_id = p.id);'),
('查stock大于0的最便宜两件商品name、price。','WHERE先筛选，再ORDER BY price ASC和LIMIT 2。','SELECT name, price FROM products WHERE stock > 0 ORDER BY price ASC, id ASC LIMIT 2;',{'ordered':True})]
}


def seed_sql(tables):
    definitions = {'products':'id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER',
                   'orders':'id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL'}
    lines = []
    for t in tables:
        lines.append(f'CREATE TABLE {t["name"]} ({definitions[t["name"]]});')
        for row in t['rows']:
            values = ', '.join('NULL' if v is None else "'" + v.replace("'","''") + "'" if isinstance(v,str) else str(v) for v in row)
            lines.append(f'INSERT INTO {t["name"]} VALUES ({values});')
    return '\n'.join(lines)


def fixtures(n):
    products = {**PRODUCTS,'rows':[row[:] for row in PRODUCTS['rows']]}
    if n in (3, 6):
        products['rows'][2][3] = None
    if n == 5:
        products['rows'][3][1] = '水果'
    tables = [products] + ([ORDERS] if n in (9,10,12) else [])
    seed = seed_sql(tables)
    if n == 11:
        seed += '\nCREATE VIEW available_products AS SELECT id, name, stock FROM products WHERE stock > 0;'
    tasks = []
    for i,task in enumerate(TASKS[n],1):
        prompt, hint, answer, *options = task
        item = {'id':f'd{n}-sql-e{i}','prompt':prompt,'hint':hint,'answer':answer,'seed':seed,**(options[0] if options else {})}
        with sqlite3.connect(':memory:') as db:
            db.executescript(seed)
            if item.get('setup'):
                db.executescript(item['setup'])
            result = db.execute(answer)
            if item.get('after') == 'ROLLBACK;':
                interim = db.execute(item['check'])
                item['expectedBefore'] = {'columns':[d[0] for d in interim.description], 'values':[list(row) for row in interim.fetchall()]}
            if item.get('after'):
                # executescript would implicitly commit before ROLLBACK in Python.
                db.execute(item['after'])
            if item.get('check'):
                result = db.execute(item['check'])
            item['expected'] = {'columns':[d[0] for d in result.description], 'values':[list(row) for row in result.fetchall()]}
        tasks.append(item)
    return {'tables':tables, 'seed':seed}, tasks
