# MySQL 入门 · 12个学习日

公开仓库：[lizhuohui777/mysql-course](https://github.com/lizhuohui777/mysql-course)。下载ZIP或克隆后，在本地打开index.html即可查看全部12课；study.html用于正式学习、按天解锁。仓库不包含个人学习记录，也未启用GitHub Pages。

本地开发检查版0.4.1-dev，12天完整课件均已制作。最新追加审查重新覆盖第1–12天：初学者读者检查顺序与推理，另一名审查者检查文字、页面、交互与代码；worker修复明确问题后，两位再核对实际输出。第1、2天没有免检，本轮修复外键图状态、必要定义与自测供给、阅读顺序、收尾措辞及记录迁移边界，未作无依据的整课重写。仍待用户学习体验验收，模拟读者与自动测试不代表实际掌握。

直接打开 `index.html`，12天可自由切换。已打开的旧页面需要刷新。可从第1天外键示例检查“尝试写入”和“已保存值”的区别，之后沿同一查询的请求与返回、索引定位与补列、事务边界、读取视角与版本、锁等待，接到连接与架构取舍。`review.html` 是同一检查入口，`study.html` 用于正式学习的完成与解锁规则。页面无需安装数据库、启动服务器或联网。界面结构复用同级network-course的成熟源码，MySQL内容、图示、来源、记录与SQL模块独立。

每天75分钟（3+45+15+12）：回忆检查、原理主线、SQL短练习、理解自测、收尾记录。每天四道短SQL题、五道理解自测与三项收尾；原站55条知识点均有映射。语法讲解与原理独立，新增练习最多两张小表，每表不超过四行。

SQL练习运行在SQLite 3.49.1（sql.js 1.13.0）中，不是MySQL。MySQL八股原理按MySQL/InnoDB解释。原理图示是机制演示，不是数据库实验或性能测量。

学习笔记、SQL草稿、自测和计时保存在当前浏览器。复制项目不会复制浏览器记录；换电脑请导出/导入学习记录。相同账号不会自动同步这些记录。

计时在切换浏览器标签页、后台查资料或与GPT交流时继续，休息请手动暂停。正常刷新或关闭前结算保存，重新打开保持暂停；切换学习日、完成课程及进入本站路线或说明页仍暂停。后台显示可能被浏览器节流，返回后按实际时间补齐。存储key、记录格式和已有累计用时不变。

导出会先展示完整内容，再由你点击下载；下载受限时有复制后备入口。开发验收结果与未实测项目见docs/REVIEW.md。

## 开发检查

```sh
python3 author_remaining.py
python3 author_remaining.py --check
python3 build.py
python3 build.py --check
node --test tests/*.test.cjs
```

第1、2天正文在lessons目录；第3–12天基础正文及SQL讲解由content_index.py、content_transactions.py、content_relations.py、content_day7.py维护。content_refinement.py是最终正文、重排及图示配置的权威修订层，修改相应覆盖内容应在该文件进行；author_remaining.py先应用它，再生成lesson和图示数据。SQL题目与数据在content_sql.py维护，小机制模型在learning-labs.js维护，最终由build.py打包。生成HTML不是手工编辑目标。依赖与许可证见vendor/README.md。未经用户明确授权不commit/push或远端发布。

交互尝试不保存、不计分、不新增完成门槛。旧笔记、草稿与计时不变；第3–12天部分自测题干已调整，旧回答需要按新题目复看。
