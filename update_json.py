#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

# 新的缩略图路径映射
thumbnail_mapping = {
    "work-c-001.png": "images/works/21世纪·可口可乐杯英语演讲比赛天津赛区决赛完美收官-封面.png",
    "work-c-002.png": "images/works/七七四十九-大国外交硕果累，外院廿二更日新-封面.png",
    "work-c-003.png": "images/works/字节跳动开放日·胡泳教授访谈提纲-封面.png",
    "work-c-004.png": "images/works/我用行动来战疫-责任担当，南开大学90后抗疫翻译志愿者故事-封面.png",
    "work-c-005.jpg": "images/works/Inspiration香氛礼盒产品卖点文案-封面.jpg",
    "work-c-006.jpg": "images/works/开放日上新，多系列9折-封面.jpg",
    "work-s-001.png": "images/works/NewsBreak-Real-Estate社区内容运营-封面.png",
    "work-s-002.png": "images/works/NewsBreak-Food社区内容运营-封面.png",
    "work-s-003.png": "images/works/品类KOL体系与内容分类体系搭建-封面.png",
    "work-l-001.png": "images/works/国际新闻编译（法译汉、英译中）-封面.png",
    "work-l-002.png": "images/works/产品类文本笔译（汉译英）-封面.png",
    "work-o-001.png": "images/works/现代诗创作《标签（外首）》《碎碎念（外章）》-封面.png",
    "work-o-003.png": "images/works/调研报告-AIGC在出版中的应用-封面.png",
}

json_file = "/Users/limaoguang/Desktop/Test/个人作品集生成/My demo/wangjunyi-portfolio/data/works.json"

with open(json_file, 'r', encoding='utf-8') as f:
    works = json.load(f)

for work in works:
    old_path = work["thumbnail"]
    filename = old_path.split('/')[-1]
    
    if filename in thumbnail_mapping:
        work["thumbnail"] = thumbnail_mapping[filename]
        print(f"更新 {work['title']}: {old_path} -> {work['thumbnail']}")
    else:
        print(f"未找到映射: {old_path}")

with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(works, f, ensure_ascii=False, indent=2)

print("\n✅ works.json 已更新！")
