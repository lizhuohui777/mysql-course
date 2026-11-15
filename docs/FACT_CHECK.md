# 12天事实核验

核验日期：2026-11-09。解释目标是MySQL 8.4基础概念；内嵌SQLite只执行通用查询，不证明MySQL机制。

## 主站与映射

阿秀学习笔记MySQL正文三页实际编号1–55，并非60条。curriculum.json保留全部55条的标题和从网页读取的锚点；重复主题在教学路线中合并，不删除来源编号。第1天使用1、2、27、37，先补数据库、表、行、列和SQL，再讨论模型、键与字符串类型。

- https://interviewguide.cn/notes/03-hunting_job/02-interview/04-01-01-MySQL.html
- https://interviewguide.cn/notes/03-hunting_job/02-interview/04-01-02-MySQL.html
- https://interviewguide.cn/notes/03-hunting_job/02-interview/04-01-03-MySQL.html

## 必要补充与纠偏

1. MySQL是数据库管理系统；SQL是语言；数据库与表不是软件。关系模型不能仅用“有两张关联的表”定义。
2. 非关系型包含文档、键值、图等模型，不等于没有结构、永远更快或不支持事务。MongoDB支持模式验证与多文档事务；Redis也不只保存简单字符串。
3. 超键能唯一识别记录；候选键是不能再删任何一列的超键，不是仅允许全局列数最少者。不能从四行样本的偶然唯一性推断设计约束。
4. 一个主键可含多列。外键与主键职责不同，外键值可重复；外键本身不自动要求非NULL。外键图明确以已声明并启用检查为条件，不假装进行数据库约束实验。
5. 原站第37题把汉字固定算作两个字节，并给出无条件的CHAR速度优势。课件不照搬：CHAR(n)、VARCHAR(n)的n是字符数；字节数取决于编码，实际空间与性能还受引擎、数据和查询影响。
6. VARCHAR保存实际内容和长度信息，不只是一个指针。默认取回时CHAR去掉尾空格，VARCHAR通常保留有效长度内的尾空格；比较中的尾空格规则取决于排序规则。超长输入的处理还受SQL模式影响。图示仅表示字符长度，不是物理页布局。
7. 查询的行顺序只有在明确排序后才有保证。本课判题比较结果中的值及重复次数；未要求排序时容许行顺序变化，排序题检查所要求的顺序。列顺序和别名可变化，不把参考答案当唯一拼写。

## 一手核验资料

- MySQL定义：https://dev.mysql.com/doc/refman/8.4/en/what-is-mysql.html
- 主键、建表与列约束：https://dev.mysql.com/doc/refman/8.4/en/create-table.html
- 外键及NULL语义：https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html
- CHAR/VARCHAR、长度与尾空格：https://dev.mysql.com/doc/refman/8.4/en/char.html
- 常见字段类型总览：https://dev.mysql.com/doc/refman/8.4/en/data-types.html
- 关系模型与键定义（Database System Concepts）：https://www.db-book.com/slides-dir/PDF-dir/ch2.pdf
- MongoDB模型、验证与事务：https://www.mongodb.com/docs/manual/
- Redis数据结构：https://redis.io/docs/latest/develop/get-started/data-store/

## SQL讲解与执行边界

- SELECT：https://www.w3schools.com/mysql/mysql_select.asp
- WHERE：https://www.w3schools.com/mysql/mysql_where.asp
- 真实执行器：SQLite 3.49.1 / sql.js 1.13.0；来源、版本和许可证见vendor/README.md。
- 第1天只执行一条SELECT，第2天按题目开放单条INSERT、UPDATE或DELETE并检查完整表状态及影响行数。第3–12天加入排序、NULL、聚合、分组、连接、UNION、视图查询、子查询和通用事务边界。共48道短题，每次独立恢复可信初始数据，Worker限制执行时间和输出。
- 第7天事务题只补一条语句，前后脚本在页面显示；回滚UPDATE题同时检查回滚前修改和回滚后全表，避免错误修改也因ROLLBACK恢复原表而通过。第9、10、12天第二表仅三行；第11天只查预建视图，不验证MySQL视图更新行为。
- 本阶段不检验MySQL的索引结构、类型存储、隔离或锁，也不提供性能实验结论。

## 首轮内容修订

依据初学者反馈，为第1天02–04补充定义与范围地图。字段类型表仅列常见类别，不冒充MySQL完整类型清单；二进制数据与字符串在教学上分开表达，官方将部分二进制类型归在字符串类型章节。INT/DECIMAL、CHAR/VARCHAR/TEXT、DATE/DATETIME和BLOB均为MySQL支持的类型。本轮没有扩展SQL执行题。

键的四项地图描述的是学习范围，不是互斥分类或全部称呼。明确主键属于候选键、候选键属于超键；多列组成与主键身份不互斥。外键也可能自引用同一张表，示例仍用订单引用商品，不把“外键”定义局限于两张不同表。

## 第2天补充与纠偏

2026-11-09读取原站第8、28、29条及下列资料，原站重复的范式说明合并为一条教学链，不复制大段原文。

1. 先补类型与约束的差别及CREATE TABLE。MySQL主键各列非NULL；可空UNIQUE允许多个NULL；CHECK为FALSE时失败，NULL造成UNKNOWN时不因此失败，须与NOT NULL配合。仅讨论默认启用的普通写入，不以SQLite代替MySQL核验。
2. 1NF解释为模型中的原子单值，不简化为“没有重复列名”，也不由某张表使用JSON否定整个数据库属于关系型。
3. 2NF排除非主属性对任一候选键的部分依赖。明确订单明细业务规则与组合候选键，区分数量的完全依赖、当前商品名称的部分依赖；“有单列主键”不是普遍充分条件。
4. 3NF用商品编号→类别编号→类别名称解释，并在折叠补充中给出超键/主属性的一般判定，避免把特殊例子当成完整定义。拆表保留关联编号，展示更新、插入和删除异常；不宣称规范化一定提高查询性能。
5. DELETE在未提交的InnoDB事务中才有用户回滚机会，默认自动提交成功后不能靠ROLLBACK撤销。TRUNCATE与普通表DROP会隐式提交；原子DDL的崩溃恢复不等于用户可ROLLBACK。TRUNCATE重置自增计数，不能用WHERE，也有外键限制；不宣称没有日志或固定速度排名。没有照搬原站“DROP自动删除表权限”的说法。
6. W3Schools辅助建表及INSERT/UPDATE/DELETE。SQL四题仍从同一张四行商品表出发，题目按完整状态验证其他行未被误改；不会拿DDL、外键或事务在SQLite中的表现证明MySQL机制。

核验资料：

- 约束：https://dev.mysql.com/doc/refman/8.4/en/create-table.html
- CHECK条件：https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html
- 函数依赖、3NF与分解：https://www.db-book.com/slides-dir/PDF-dir/ch7.pdf
- 2NF组合候选键教学例子：https://www.cs.virginia.edu/~up3f/cs4750/slides/4750meet09-normalization.pdf
- DELETE：https://dev.mysql.com/doc/refman/8.4/en/delete.html
- TRUNCATE：https://dev.mysql.com/doc/refman/8.4/en/truncate-table.html
- DROP普通表与临时表差别：https://dev.mysql.com/doc/refman/8.4/en/drop-table.html
- 事务与自动提交：https://dev.mysql.com/doc/refman/8.4/en/commit.html
- 语法：https://www.w3schools.com/mysql/mysql_create_table.asp
- 插入：https://www.w3schools.com/mysql/mysql_insert.asp
- 修改：https://www.w3schools.com/mysql/mysql_update.asp
- 删除：https://www.w3schools.com/mysql/mysql_delete.asp

## 第3–6天：执行与索引

1. 原站旧执行链含整条SQL查询缓存，MySQL 8.0已移除；InnoDB Buffer Pool仍缓存数据页和索引页。默认16KB页可配置；缓存命中不是查询零开销。
2. InnoDB聚簇叶子承载行数据，通常由主键组织；无主键时选择合适唯一非空索引，否则生成内部标识。二级叶子携带主键，长主键会重复占用二级空间。MyISAM的记录位置组织不能套成InnoDB聚簇布局。
3. B+树内部导航、有序叶子与多路分叉有利于页式查找及范围访问，不宣称必然三层、每页无限分叉或Hash永远更快。MEMORY可有Hash索引；InnoDB自适应Hash不等于用户声明的通用Hash索引。
4. 最左前缀来自索引列顺序，不来自WHERE书写顺序。范围后的列可能继续过滤或覆盖；缺少左列也有特殊优化路径。NULL可被索引，OR、!=、函数不是无条件失效开关。
5. EXPLAIN的rows是估计，possible_keys是候选，key是选择；Using index与Using index condition含义不同。EXPLAIN ANALYZE实际执行查询。四行SQL练习不证明索引速度。

核验资料：

- 查询缓存移除：https://dev.mysql.com/doc/refman/8.0/en/mysql-nutshell.html
- 缓冲池：https://dev.mysql.com/doc/refman/8.4/en/innodb-buffer-pool.html
- 页与行组织：https://dev.mysql.com/doc/refman/8.4/en/innodb-physical-structure.html
- 聚簇与二级：https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html
- B树与Hash适用条件：https://dev.mysql.com/doc/refman/8.4/en/index-btree-hash.html
- 多列索引：https://dev.mysql.com/doc/refman/8.4/en/multiple-column-indexes.html
- 执行计划：https://dev.mysql.com/doc/refman/8.4/en/explain.html

## 第7–10天：事务、版本与锁

1. ACID一致性还依赖正确业务程序与约束；两步原子提交不会自动纠正“扣10、加20”。自动提交成功后ROLLBACK不能恢复历史。语句错误、死锁、等待超时的回滚范围不能一概而论。
   第7天将失败固定为第二条修改未能完成，并要求主动ROLLBACK；最终0.4.0演示两种边界并排，余额只表示本次执行状态，不推断其他事务的可见性。一致性在本例检查事务结束后的总额规则，不把临时总额140错误地判为原子性失效。恢复选择要求在承诺条件下有足够的持久恢复信息，不宣称COMMIT必须同步刷完所有数据页。题14/31/51映射保留，没有以SQLite执行证明MySQL事务机制。
2. 标准隔离现象表与InnoDB实现分开。RR普通一致性读通常复用首次一致性读建立的快照，未必BEGIN时建立，自己的写入可见；锁定读和UPDATE等按当前访问规则工作，不能背成RR绝不会看到任何新信息。
3. undo用于撤销与旧版本构建，更新undo提交后可能仍被快照需要，purge逐步清理，长事务可能拖延。Read View不是整库副本，活跃集合与时点不能简化成“只要已提交就可见”。
4. redo支持崩溃恢复，不代表全部日志都是已提交业务；提交不要求全部数据页立即写回。WAL、检查点与循环复用有不同职责。持久性有innodb_flush_log_at_trx_commit和可靠存储前提；redo、undo、binlog均不能代替完整备份策略。
5. 锁模式与粒度分开；无合适索引可能扩大记录/范围锁定，不是自动表锁升级。现存完整唯一等值查找通常只锁记录，范围访问的next-key需固定隔离、索引与计划；gap锁间不完全套用S/X记录兼容表。乐观版本检查仍会使用真实UPDATE写锁。

0.4.0模型边界：RC/RR读取比较固定首次读10、外部提交8及同一事务，无自身写入；锁定读假设外部已提交释放锁。版本模型只有一个更新者和两个版本，按视图时点及活跃状态判断，不以事务号大小替代可见算法。恢复模型固定内存8/磁盘10/同一崩溃，只改变持久恢复信息；无安全信息却确认成功是错误策略反例。next-key显式给定(10,20]，不由SQL小数据推断真实锁边界；死锁演示主动选回滚B，不声称InnoDB总选B。

核验资料：

- 提交与自动提交：https://dev.mysql.com/doc/refman/8.4/en/commit.html
- 隔离级别：https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html
- 一致性读：https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html
- 锁定读：https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html
- undo：https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html
- redo：https://dev.mysql.com/doc/refman/8.4/en/innodb-redo-log.html
- 持久化参数：https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit
- 锁类型：https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html
- next-key：https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html
- 死锁：https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html

## 第11–12天：关系与架构

1. JOIN按条件组合，可能一对多；自连接是角色维度，可同时是LEFT JOIN。MySQL 8.4没有原生FULL OUTER JOIN。UNION去重、UNION ALL保留重复，不拿DISTINCT无条件补救错误连接。
2. 普通视图保存查询定义，不是固定结果或性能缓存。可更新有边界，聚合、DISTINCT、GROUP BY、UNION等通常不可更新；WITH CHECK OPTION限制通过视图写入仍符合定义。游标是只读、不可滚动的存储程序机制，不要求编写长循环。
3. 垂直拆列/业务与水平拆行不同；同实例多库名称不等于新增资源，MySQL分区不等于跨实例分片。每天五万行三年约5475万行只是规模估算，不能据此硬定分表阈值，也不是QPS。
4. 缓存失效、复制延迟、跨片事务和聚合均有成本；副本不天然保证读己之写，复制可传播误删，不等于万能备份。EXISTS只判断有无匹配，不因多条订单重复输出外层商品；NOT IN有NULL时不能随意等同NOT EXISTS。

核验资料：

- 连接语法：https://dev.mysql.com/doc/refman/8.4/en/join.html
- 视图更新限制：https://dev.mysql.com/doc/refman/8.4/en/view-updatability.html
- 游标：https://dev.mysql.com/doc/refman/8.4/en/cursors.html
- 子查询：https://dev.mysql.com/doc/refman/8.4/en/subqueries.html
- 优化：https://dev.mysql.com/doc/refman/8.4/en/optimization.html
- 分区：https://dev.mysql.com/doc/refman/8.4/en/partitioning-overview.html
- 复制：https://dev.mysql.com/doc/refman/8.4/en/replication.html

## 0.4.1审查修正

1. MVCC模型的两个错误答案分别按所选视图反馈；新视图建立前T2已提交时，最新8可见，不用旧视图的解释回应错误的10。版本表仅展示两版、单个更新者的简化判断。
2. EXPLAIN与抽象成本显式标为手写教学模型，展示ref/idx_stock或ALL/NULL与访问路径的对应，不能称为真实优化器预测或测量。四行扫描并不足以证明需要索引；诊断将证据不足与明确大表、高频、读取瓶颈情形分开。
3. 库存条件递减由InnoDB按当前可修改记录求值并协调写锁，区别于先读10再写绝对9；影响0行要处理。锁定范围阻止插入与RR普通快照保持旧集合分别说明。只观察代表性的next-key区间，不从示意SQL推断完整实际锁集合。
4. MySQL存储程序游标循环在服务器端，不意味着每次FETCH发生客户端网络往返。死锁会完整回滚一个事务，可重试整笔；锁等待超时默认通常仅回滚当前语句。外部副作用或提交不确定时的幂等处理另行考虑。
5. 扇出比较固定四叶与同一目标；局部性比较固定相同初始页、写入数与足够空位，不把分裂状态混入因果。视图、缓存和副本分别注明初始、修改提交、可见读取或同步完成阶段。

核验资料：

- https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html
- https://dev.mysql.com/doc/refman/8.4/en/cursors.html
- https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html
- https://dev.mysql.com/doc/refman/8.4/en/explain-output.html

## 来源链接验收

2026-11-09读取主站三页HTML并比对全部55条实际id锚点，各页缺失列表均为空。W3Schools辅助链接通过其可见导航核验；MIN/MAX使用mysql_min_max.asp，视图使用mysql_view.asp。无法核实的猜测链接已去除，事务及子查询另用MySQL官方资料补齐。系统curl对W3Schools返回403，不据此判定页面不存在，也不绕过访问限制。

## 2026-11-15顺序学习模型边界

本轮核对作者源、图示模型与生成输出，沿用以上既有资料链接；没有把本地审查写成重新抓取官方页面，也没有连接真实MySQL进行机制或性能实验。第1、2天正文、48题SQL与可信数据保持不变。

1. 第3天图是同一次SQL请求与记录返回，服务层和InnoDB位于同一服务器。磁盘页P与缓冲池P表示同页的存储内容和内存副本。第5天主键叶子中的行就是该批商品，name二级项携带主键，不另复制商品；INDEX(name)、UNIQUE(name,price)是定义中的声明片段，不作为独立SELECT运行。覆盖只比较补列工作，未排除MVCC检查访问聚簇记录。
2. B+树和扇出使用固定小树、子页引用和四片叶页，不把示意指针数当实际页容量。红黑树只对照最多两个子分支，不模拟颜色维护。联合索引使用显式教学名称顺序；每项标明候选与匹配。EXPLAIN和成本均手写，选择扫描显示ALL/NULL，选择等值索引显示ref、范围索引显示range；推荐与用户指定路径分开，不声称真实优化器必选这些计划。
3. 第8、9天统一为T2先BEGIN并改8未提交、T1首次普通SELECT建立旧视图并读10、T2提交、T1再次读。当前记录8、undo历史关联和Read View信息不混成三份商品；旧、新视图的逐版依据默认可见。Read View判断不只比较编号或现在是否提交。普通SELECT不等于S锁，FOR SHARE/UPDATE图在显式事务内说明取得、等待和结束释放；next-key只观察给定(10,20]，不推断真实SQL全部锁集合。应用version列不是MVCC内置事务标识。
4. 恢复固定内存8、磁盘10和同一进程崩溃，只有足够持久redo时才据本例恢复8。无持久依据却确认成功是错误策略反例，不是正常安全配置的MySQL提交。日志集中顺序写与分散页逐步写回只解释工作组织，持久承诺仍受配置、设备及故障范围限制，不替代备份。
5. JOIN按每个商品/订单对产生行，LEFT补NULL只发生在结果。游标用假设已有的单件核对过程解释FETCH后怎样处理，不运行MySQL存储程序、不宣称必须用游标。垂直拆分的8格页、4格整行、2格核心行是固定容量模型；实际长值可能页外存储，减少返回列不等于减少存储行宽或读盘。水平例从A的10+20=30、B的8+12=20合并50，用户3只取20，不混成A全片合计。缓存/副本阶段仍是同步时序示意，不是完整强一致协议。

## 2026-11-15追加全课检查

第1、2天同样重新审查，不沿用历史认可免检。外键图保留已存product_id=4，准备写入的9明确单列为尝试值；启用检查时更新被拒绝，不把失败值留作已保存记录。第2天仅修一般3NF判定的错字。Hash用不同键落同桶说明碰撞，不提供真实散列公式；第8天只说明FOR UPDATE协调同记录冲突修改，不宣称阻塞普通一致性读。

必答自测需要的跳号边界移到常显正文，EXPLAIN字段释义移到使用它的图之前；其他不影响必答的扩展保留折叠。第7、11天收尾检查理解，不强制完成SQL练题。以上沿用已有一手资料与课内小例，没有声称本轮重新抓取全部外部页面或进行真实MySQL实验。

记录迁移是应用代码边界，不是MySQL知识：当前230字符串字段、36布尔字段允许的最大JSON转义导出约27.6MB，旧10MiB导入上限不闭合。32MiB guard用实际app事件和完整catalog合成记录验证；逐字段20000字符、记录格式、覆盖确认与计时协议不变。
