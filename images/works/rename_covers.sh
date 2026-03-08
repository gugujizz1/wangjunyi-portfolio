#!/bin/bash

cd /Users/limaoguang/Desktop/Test/个人作品集生成/My\ demo/wangjunyi-portfolio/images/works

# 重命名新的封面图片为作品名-封面格式
echo "开始重命名封面图片..."

# 文化宣传类
mv "微信图片_20260308162446_57_15.png" "七七四十九-大国外交硕果累，外院廿二更日新-封面.png" 2>/dev/null
mv "微信图片_20260308162721_58_15.png" "字节跳动开放日·胡泳教授访谈提纲-封面.png" 2>/dev/null
mv "微信图片_20260308162747_59_15.png" "我用行动来战疫-责任担当，南开大学90后抗疫翻译志愿者故事-封面.png" 2>/dev/null
mv "微信图片_20260308163414_23857_1.jpg" "Inspiration香氛礼盒产品卖点文案-封面.jpg" 2>/dev/null
mv "微信图片_20260308163349_23856_1.jpg" "开放日上新，多系列9折-封面.jpg" 2>/dev/null

# 社区内容类
mv "微信图片_20260308162945_62_15.png" "NewsBreak-Real-Estate社区内容运营-封面.png" 2>/dev/null
mv "微信图片_20260308162959_63_15.png" "NewsBreak-Food社区内容运营-封面.png" 2>/dev/null
mv "微信图片_20260308163024_65_15.png" "品类KOL体系与内容分类体系搭建-封面.png" 2>/dev/null

# 语言服务类
mv "微信图片_20260308163051_67_15.png" "国际新闻编译（法译汉、英译中）-封面.png" 2>/dev/null
mv "微信图片_20260308163113_72_15.png" "产品类文本笔译（汉译英）-封面.png" 2>/dev/null

# 其他作品类
mv "微信图片_20260308163143_74_15.png" "现代诗创作《标签（外首）》《碎碎念（外章）》-封面.png" 2>/dev/null
mv "微信图片_20260308163242_75_15.png" "调研报告-AIGC在出版中的应用-封面.png" 2>/dev/null

echo "重命名完成！"
echo ""
echo "当前文件列表："
ls -1 *-封面* 2>/dev/null

# 删除其他不需要的微信图片和临时文件
echo ""
echo "删除不需要的微信图片..."
rm 微信图片_*.png 微信图片_*.jpg 2>/dev/null
rm 1png.png 2>/dev/null

echo "清理完成！"
echo ""
echo "最终文件列表："
ls -1 *-封面*
