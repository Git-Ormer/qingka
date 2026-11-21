/* 轻卡 · 内置常见食物库
 * 数值为每 100g（饮品为每 100ml）的参考值，来源：中国食物成分表、USDA 及常见包装标示，取整后仅供估算。
 * portion 为常见一份的参考重量，方便快速记录。
 */
(function (root) {
  var FOODS = [
    // 主食
    { id: 'f001', name: '米饭（熟）', cat: '主食', kcal: 116, carb: 25.9, protein: 2.6, fat: 0.3, portion: { label: '1 碗', grams: 150 } },
    { id: 'f002', name: '糙米饭（熟）', cat: '主食', kcal: 112, carb: 23.0, protein: 2.6, fat: 0.9, portion: { label: '1 碗', grams: 150 } },
    { id: 'f003', name: '白粥', cat: '主食', kcal: 46, carb: 9.9, protein: 1.1, fat: 0.2, portion: { label: '1 碗', grams: 250 } },
    { id: 'f004', name: '馒头', cat: '主食', kcal: 223, carb: 47.0, protein: 7.0, fat: 1.1, portion: { label: '1 个', grams: 100 } },
    { id: 'f005', name: '全麦面包', cat: '主食', kcal: 246, carb: 41.0, protein: 9.0, fat: 3.4, portion: { label: '1 片', grams: 35 } },
    { id: 'f006', name: '白吐司', cat: '主食', kcal: 265, carb: 49.0, protein: 9.0, fat: 3.2, portion: { label: '1 片', grams: 35 } },
    { id: 'f007', name: '面条（熟）', cat: '主食', kcal: 110, carb: 22.0, protein: 4.0, fat: 0.5, portion: { label: '1 碗', grams: 200 } },
    { id: 'f008', name: '意大利面（熟）', cat: '主食', kcal: 158, carb: 30.9, protein: 5.8, fat: 0.9, portion: { label: '1 份', grams: 200 } },
    { id: 'f009', name: '红薯（蒸）', cat: '主食', kcal: 86, carb: 20.0, protein: 1.6, fat: 0.1, portion: { label: '1 个', grams: 200 } },
    { id: 'f010', name: '土豆（蒸）', cat: '主食', kcal: 77, carb: 17.0, protein: 2.0, fat: 0.1, portion: { label: '1 个', grams: 150 } },
    { id: 'f011', name: '玉米（煮）', cat: '主食', kcal: 112, carb: 22.8, protein: 4.0, fat: 1.2, portion: { label: '1 根', grams: 200 } },
    { id: 'f012', name: '燕麦片（干）', cat: '主食', kcal: 377, carb: 66.0, protein: 13.0, fat: 6.7, portion: { label: '1 份', grams: 40 } },
    { id: 'f013', name: '藜麦（熟）', cat: '主食', kcal: 120, carb: 21.0, protein: 4.4, fat: 1.9, portion: { label: '1 碗', grams: 150 } },
    { id: 'f014', name: '米粉（熟）', cat: '主食', kcal: 109, carb: 24.9, protein: 1.8, fat: 0.2, portion: { label: '1 碗', grams: 200 } },
    { id: 'f015', name: '猪肉白菜饺子', cat: '主食', kcal: 240, carb: 26.0, protein: 8.0, fat: 11.0, portion: { label: '1 个', grams: 20 } },
    { id: 'f016', name: '肉包子', cat: '主食', kcal: 227, carb: 28.0, protein: 8.0, fat: 9.0, portion: { label: '1 个', grams: 100 } },
    { id: 'f017', name: '油条', cat: '主食', kcal: 388, carb: 51.0, protein: 6.9, fat: 17.6, portion: { label: '1 根', grams: 60 } },
    { id: 'f018', name: '紫薯（蒸）', cat: '主食', kcal: 82, carb: 19.0, protein: 1.4, fat: 0.2, portion: { label: '1 个', grams: 150 } },

    // 肉蛋
    { id: 'f020', name: '鸡蛋（煮）', cat: '肉蛋', kcal: 144, carb: 2.8, protein: 13.3, fat: 8.8, portion: { label: '1 个', grams: 50 } },
    { id: 'f021', name: '鸡蛋白', cat: '肉蛋', kcal: 60, carb: 3.1, protein: 11.6, fat: 0.1, portion: { label: '1 个', grams: 30 } },
    { id: 'f022', name: '鸡胸肉（熟）', cat: '肉蛋', kcal: 165, carb: 0, protein: 31.0, fat: 3.6, portion: { label: '1 块', grams: 100 } },
    { id: 'f023', name: '鸡腿肉（熟，去皮）', cat: '肉蛋', kcal: 209, carb: 0, protein: 26.0, fat: 10.9, portion: { label: '1 个', grams: 80 } },
    { id: 'f024', name: '瘦牛肉（生）', cat: '肉蛋', kcal: 106, carb: 1.2, protein: 20.2, fat: 2.3, portion: { label: '1 份', grams: 100 } },
    { id: 'f025', name: '猪里脊（生）', cat: '肉蛋', kcal: 155, carb: 0.7, protein: 20.2, fat: 7.9, portion: { label: '1 份', grams: 100 } },
    { id: 'f026', name: '三文鱼（生）', cat: '肉蛋', kcal: 208, carb: 0, protein: 20.0, fat: 13.0, portion: { label: '1 份', grams: 100 } },
    { id: 'f027', name: '鳕鱼', cat: '肉蛋', kcal: 88, carb: 0, protein: 20.4, fat: 0.5, portion: { label: '1 块', grams: 100 } },
    { id: 'f028', name: '虾（熟）', cat: '肉蛋', kcal: 99, carb: 0.2, protein: 24.0, fat: 0.3, portion: { label: '1 份', grams: 100 } },
    { id: 'f029', name: '金枪鱼罐头（水浸）', cat: '肉蛋', kcal: 116, carb: 0, protein: 26.0, fat: 1.0, portion: { label: '1 罐', grams: 100 } },
    { id: 'f030', name: '鸭肉（熟）', cat: '肉蛋', kcal: 240, carb: 0, protein: 19.0, fat: 18.0, portion: { label: '1 份', grams: 100 } },

    // 豆奶
    { id: 'f032', name: '北豆腐', cat: '豆奶', kcal: 98, carb: 2.0, protein: 12.2, fat: 4.8, portion: { label: '1 块', grams: 100 } },
    { id: 'f033', name: '嫩豆腐', cat: '豆奶', kcal: 57, carb: 2.9, protein: 5.7, fat: 2.7, portion: { label: '1 块', grams: 100 } },
    { id: 'f034', name: '无糖豆浆', cat: '豆奶', kcal: 31, carb: 1.2, protein: 3.0, fat: 1.6, portion: { label: '1 杯', grams: 250 }, unit: 'ml' },
    { id: 'f035', name: '全脂牛奶', cat: '豆奶', kcal: 65, carb: 4.9, protein: 3.3, fat: 3.6, portion: { label: '1 杯', grams: 250 }, unit: 'ml' },
    { id: 'f036', name: '低脂牛奶', cat: '豆奶', kcal: 45, carb: 5.0, protein: 3.4, fat: 1.3, portion: { label: '1 杯', grams: 250 }, unit: 'ml' },
    { id: 'f037', name: '希腊酸奶（无糖）', cat: '豆奶', kcal: 59, carb: 3.6, protein: 10.0, fat: 0.4, portion: { label: '1 杯', grams: 150 } },
    { id: 'f038', name: '无糖酸奶', cat: '豆奶', kcal: 62, carb: 4.7, protein: 3.5, fat: 3.3, portion: { label: '1 杯', grams: 150 } },
    { id: 'f039', name: '乳清蛋白粉', cat: '豆奶', kcal: 380, carb: 8.0, protein: 78.0, fat: 5.0, portion: { label: '1 勺', grams: 30 } },
    { id: 'f040', name: '毛豆', cat: '豆奶', kcal: 131, carb: 10.0, protein: 13.0, fat: 5.0, portion: { label: '1 份', grams: 100 } },
    { id: 'f041', name: '鹰嘴豆（熟）', cat: '豆奶', kcal: 164, carb: 27.0, protein: 8.9, fat: 2.6, portion: { label: '1 份', grams: 100 } },
    { id: 'f042', name: '切达芝士', cat: '豆奶', kcal: 403, carb: 1.3, protein: 25.0, fat: 33.0, portion: { label: '1 片', grams: 20 } },

    // 蔬菜
    { id: 'f045', name: '西兰花', cat: '蔬菜', kcal: 34, carb: 6.6, protein: 2.8, fat: 0.4, portion: { label: '1 份', grams: 150 } },
    { id: 'f046', name: '菠菜', cat: '蔬菜', kcal: 23, carb: 3.6, protein: 2.9, fat: 0.4, portion: { label: '1 份', grams: 100 } },
    { id: 'f047', name: '生菜', cat: '蔬菜', kcal: 15, carb: 2.9, protein: 1.4, fat: 0.2, portion: { label: '1 份', grams: 100 } },
    { id: 'f048', name: '番茄', cat: '蔬菜', kcal: 18, carb: 3.9, protein: 0.9, fat: 0.2, portion: { label: '1 个', grams: 150 } },
    { id: 'f049', name: '黄瓜', cat: '蔬菜', kcal: 15, carb: 3.6, protein: 0.7, fat: 0.1, portion: { label: '1 根', grams: 200 } },
    { id: 'f050', name: '胡萝卜', cat: '蔬菜', kcal: 41, carb: 9.6, protein: 0.9, fat: 0.2, portion: { label: '1 根', grams: 100 } },
    { id: 'f051', name: '大白菜', cat: '蔬菜', kcal: 17, carb: 3.2, protein: 1.5, fat: 0.1, portion: { label: '1 份', grams: 150 } },
    { id: 'f052', name: '香菇', cat: '蔬菜', kcal: 26, carb: 5.2, protein: 2.2, fat: 0.3, portion: { label: '1 份', grams: 100 } },
    { id: 'f053', name: '茄子', cat: '蔬菜', kcal: 25, carb: 5.9, protein: 1.0, fat: 0.2, portion: { label: '1 份', grams: 150 } },
    { id: 'f054', name: '青椒', cat: '蔬菜', kcal: 22, carb: 5.4, protein: 1.0, fat: 0.2, portion: { label: '1 个', grams: 100 } },
    { id: 'f055', name: '南瓜', cat: '蔬菜', kcal: 23, carb: 5.3, protein: 0.7, fat: 0.1, portion: { label: '1 份', grams: 150 } },

    // 水果
    { id: 'f060', name: '苹果', cat: '水果', kcal: 52, carb: 13.8, protein: 0.3, fat: 0.2, portion: { label: '1 个', grams: 200 } },
    { id: 'f061', name: '香蕉', cat: '水果', kcal: 89, carb: 22.8, protein: 1.1, fat: 0.3, portion: { label: '1 根', grams: 120 } },
    { id: 'f062', name: '橙子', cat: '水果', kcal: 47, carb: 11.8, protein: 0.9, fat: 0.1, portion: { label: '1 个', grams: 180 } },
    { id: 'f063', name: '蓝莓', cat: '水果', kcal: 57, carb: 14.5, protein: 0.7, fat: 0.3, portion: { label: '1 盒', grams: 100 } },
    { id: 'f064', name: '草莓', cat: '水果', kcal: 32, carb: 7.7, protein: 0.7, fat: 0.3, portion: { label: '1 份', grams: 150 } },
    { id: 'f065', name: '西瓜', cat: '水果', kcal: 30, carb: 7.6, protein: 0.6, fat: 0.2, portion: { label: '1 块', grams: 250 } },
    { id: 'f066', name: '葡萄', cat: '水果', kcal: 69, carb: 18.1, protein: 0.7, fat: 0.2, portion: { label: '1 份', grams: 150 } },
    { id: 'f067', name: '猕猴桃', cat: '水果', kcal: 61, carb: 14.7, protein: 1.1, fat: 0.5, portion: { label: '1 个', grams: 100 } },
    { id: 'f068', name: '牛油果', cat: '水果', kcal: 160, carb: 8.5, protein: 2.0, fat: 14.7, portion: { label: '1 个', grams: 150 } },

    // 坚果油脂
    { id: 'f070', name: '杏仁', cat: '坚果', kcal: 579, carb: 21.6, protein: 21.2, fat: 49.9, portion: { label: '1 把', grams: 25 } },
    { id: 'f071', name: '核桃', cat: '坚果', kcal: 654, carb: 13.7, protein: 15.2, fat: 65.2, portion: { label: '1 把', grams: 25 } },
    { id: 'f072', name: '花生', cat: '坚果', kcal: 574, carb: 16.1, protein: 24.8, fat: 44.3, portion: { label: '1 把', grams: 25 } },
    { id: 'f073', name: '花生酱', cat: '坚果', kcal: 588, carb: 20.0, protein: 25.0, fat: 50.0, portion: { label: '1 勺', grams: 15 } },
    { id: 'f074', name: '橄榄油', cat: '坚果', kcal: 884, carb: 0, protein: 0, fat: 100, portion: { label: '1 勺', grams: 10 } },
    { id: 'f075', name: '黄油', cat: '坚果', kcal: 717, carb: 0.1, protein: 0.9, fat: 81.0, portion: { label: '1 块', grams: 10 } },

    // 零食
    { id: 'f080', name: '薯片', cat: '零食', kcal: 536, carb: 53.0, protein: 7.0, fat: 34.0, portion: { label: '1 包', grams: 50 } },
    { id: 'f081', name: '黑巧克力（70%）', cat: '零食', kcal: 598, carb: 45.9, protein: 7.8, fat: 42.6, portion: { label: '1 块', grams: 10 } },
    { id: 'f082', name: '苏打饼干', cat: '零食', kcal: 408, carb: 76.0, protein: 8.4, fat: 7.7, portion: { label: '1 片', grams: 5 } },
    { id: 'f083', name: '冰淇淋', cat: '零食', kcal: 207, carb: 23.6, protein: 3.5, fat: 11.0, portion: { label: '1 球', grams: 50 } },
    { id: 'f084', name: '奶油蛋糕', cat: '零食', kcal: 347, carb: 47.0, protein: 5.0, fat: 16.0, portion: { label: '1 块', grams: 100 } },

    // 饮品
    { id: 'f090', name: '可乐', cat: '饮品', kcal: 43, carb: 10.6, protein: 0, fat: 0, portion: { label: '1 罐', grams: 330 }, unit: 'ml' },
    { id: 'f091', name: '无糖气泡水', cat: '饮品', kcal: 0, carb: 0, protein: 0, fat: 0, portion: { label: '1 罐', grams: 330 }, unit: 'ml' },
    { id: 'f092', name: '啤酒', cat: '饮品', kcal: 43, carb: 3.6, protein: 0.5, fat: 0, portion: { label: '1 罐', grams: 330 }, unit: 'ml' },
    { id: 'f093', name: '美式咖啡', cat: '饮品', kcal: 2, carb: 0, protein: 0.1, fat: 0, portion: { label: '1 杯', grams: 240 }, unit: 'ml' },
    { id: 'f094', name: '珍珠奶茶', cat: '饮品', kcal: 80, carb: 14.5, protein: 0.6, fat: 2.4, portion: { label: '1 杯', grams: 500 }, unit: 'ml' },
    { id: 'f095', name: '橙汁', cat: '饮品', kcal: 45, carb: 10.4, protein: 0.7, fat: 0.2, portion: { label: '1 杯', grams: 250 }, unit: 'ml' },

    // 快餐
    { id: 'f100', name: '巨无霸汉堡', cat: '快餐', kcal: 257, carb: 20.3, protein: 12.6, fat: 14.6, portion: { label: '1 个', grams: 215 } },
    { id: 'f101', name: '炸鸡（带皮）', cat: '快餐', kcal: 290, carb: 8.0, protein: 22.0, fat: 19.0, portion: { label: '1 块', grams: 100 } },
    { id: 'f102', name: '薯条', cat: '快餐', kcal: 312, carb: 41.0, protein: 3.4, fat: 15.0, portion: { label: '1 份', grams: 115 } },
    { id: 'f103', name: '披萨（芝士）', cat: '快餐', kcal: 266, carb: 33.0, protein: 11.0, fat: 10.0, portion: { label: '1 片', grams: 100 } },
    { id: 'f104', name: '三文鱼寿司', cat: '快餐', kcal: 140, carb: 29.0, protein: 4.0, fat: 1.0, portion: { label: '1 个', grams: 30 } },
    { id: 'f105', name: '兰州拉面', cat: '快餐', kcal: 130, carb: 22.0, protein: 5.0, fat: 2.5, portion: { label: '1 碗', grams: 500 } }
  ];

  var CATS = ['全部', '主食', '肉蛋', '豆奶', '蔬菜', '水果', '坚果', '零食', '饮品', '快餐'];

  function asFood(item) {
    return {
      id: item.id,
      name: item.name,
      brand: '',
      cat: item.cat,
      unit: item.unit || 'g',
      per100: { kcal: item.kcal, carb: item.carb, protein: item.protein, fat: item.fat },
      portion: item.portion,
      source: 'local'
    };
  }

  root.FOODS = FOODS;
  root.FOOD_CATS = CATS;
  root.asFood = asFood;
})(typeof self !== 'undefined' ? self : this);
