const CATEGORIES = [
    { id: 'all', name: '全部' },
    { id: 'classic', name: '经典咖啡' },
    { id: 'special', name: '特调拿铁' },
    { id: 'tea', name: '茶与可可' },
    { id: 'dessert', name: '甜点' },
];

const PRODUCTS = [
    {
        id: 'p01',
        category: 'classic',
        name: '美式咖啡',
        en: 'Americano',
        desc: '双份浓缩兑热水，清醒得很直接',
        price: 18,
        tag: '人气',
        short: '美',
        gradient: 'linear-gradient(135deg, #6b4226, #33241a)',
        drinkable: true,
    },
    {
        id: 'p02',
        category: 'classic',
        name: '拿铁',
        en: 'Latte',
        desc: '浓缩加蒸奶，奶泡绵密，日常首选',
        price: 24,
        tag: '',
        short: '拿',
        gradient: 'linear-gradient(135deg, #c89872, #8a5a37)',
        drinkable: true,
    },
    {
        id: 'p03',
        category: 'classic',
        name: '卡布奇诺',
        en: 'Cappuccino',
        desc: '三分之一奶泡，入口轻，回味厚',
        price: 24,
        tag: '',
        short: '卡',
        gradient: 'linear-gradient(135deg, #d8b892, #9c6a41)',
        drinkable: true,
    },
    {
        id: 'p04',
        category: 'classic',
        name: '澳白',
        en: 'Flat White',
        desc: '双份浓缩配薄奶泡，咖啡味更突出',
        price: 26,
        tag: '店长推荐',
        short: '澳',
        gradient: 'linear-gradient(135deg, #b07a4c, #5d3a22)',
        drinkable: true,
    },
    {
        id: 'p05',
        category: 'special',
        name: '生椰拿铁',
        en: 'Coconut Latte',
        desc: '厚椰乳打底，甜感自然不腻',
        price: 28,
        tag: '招牌',
        short: '椰',
        gradient: 'linear-gradient(135deg, #e5d3b3, #b58d5f)',
        drinkable: true,
    },
    {
        id: 'p06',
        category: 'special',
        name: '焦糖玛奇朵',
        en: 'Caramel Macchiato',
        desc: '焦糖淋面，甜咸交织的三层口感',
        price: 28,
        tag: '',
        short: '焦',
        gradient: 'linear-gradient(135deg, #d9a05b, #8c5a2b)',
        drinkable: true,
    },
    {
        id: 'p07',
        category: 'special',
        name: '海盐芝士咖啡',
        en: 'Sea Salt Cheese',
        desc: '芝士奶盖加一小撮海盐，咸甜分明',
        price: 30,
        tag: '新品',
        short: '盐',
        gradient: 'linear-gradient(135deg, #cfd6d2, #8d9a92)',
        drinkable: true,
    },
    {
        id: 'p08',
        category: 'tea',
        name: '抹茶拿铁',
        en: 'Matcha Latte',
        desc: '宇治抹茶配鲜奶，微苦回甘',
        price: 26,
        tag: '',
        short: '抹',
        gradient: 'linear-gradient(135deg, #a8bb8a, #5f7448)',
        drinkable: true,
    },
    {
        id: 'p09',
        category: 'tea',
        name: '热可可',
        en: 'Hot Chocolate',
        desc: '70% 黑巧融化，浓到有点粘杯',
        price: 24,
        tag: '',
        short: '可',
        gradient: 'linear-gradient(135deg, #8a5a3c, #40261a)',
        drinkable: true,
    },
    {
        id: 'p10',
        category: 'dessert',
        name: '黄油可颂',
        en: 'Croissant',
        desc: '每天现烤，层次分明，趁热吃',
        price: 15,
        tag: '',
        short: '可',
        gradient: 'linear-gradient(135deg, #e8c47a, #b3813a)',
        drinkable: false,
    },
    {
        id: 'p11',
        category: 'dessert',
        name: '提拉米苏',
        en: 'Tiramisu',
        desc: '马斯卡彭配手指饼干，酒香轻',
        price: 26,
        tag: '人气',
        short: '提',
        gradient: 'linear-gradient(135deg, #c9a382, #6d4327)',
        drinkable: false,
    },
    {
        id: 'p12',
        category: 'dessert',
        name: '巴斯克芝士',
        en: 'Basque Cheesecake',
        desc: '表面焦糖化，内里半熟流动',
        price: 28,
        tag: '',
        short: '巴',
        gradient: 'linear-gradient(135deg, #e3c08c, #a2713c)',
        drinkable: false,
    },
];

const SIZES = [
    { id: 'm', name: '中杯 355ml', extra: 0 },
    { id: 'l', name: '大杯 473ml', extra: 3 },
];

const TEMPERATURES = [
    { id: 'hot', name: '热' },
    { id: 'ice', name: '冰' },
];

const SUGARS = [
    { id: 'std', name: '标准糖' },
    { id: 'half', name: '半糖' },
    { id: 'none', name: '无糖' },
];

const EXTRAS = [
    { id: 'shot', name: '加一份浓缩', price: 4 },
    { id: 'oat', name: '换燕麦奶', price: 5 },
    { id: 'cream', name: '奶油顶', price: 6 },
];

const PICKUP_TYPES = [
    { id: 'self', name: '到店自取' },
    { id: 'dine', name: '堂食' },
];

const DISCOUNT_THRESHOLD = 50;
const DISCOUNT_AMOUNT = 8;

function findProduct(productId) {
    for (let i = 0; i < PRODUCTS.length; i += 1) {
        if (PRODUCTS[i].id === productId) {
            return PRODUCTS[i];
        }
    }
    return null;
}

function filterProducts(categoryId) {
    if (!categoryId || categoryId === 'all') {
        return PRODUCTS.slice();
    }
    return PRODUCTS.filter(function (item) {
        return item.category === categoryId;
    });
}

module.exports = {
    CATEGORIES: CATEGORIES,
    PRODUCTS: PRODUCTS,
    SIZES: SIZES,
    TEMPERATURES: TEMPERATURES,
    SUGARS: SUGARS,
    EXTRAS: EXTRAS,
    PICKUP_TYPES: PICKUP_TYPES,
    DISCOUNT_THRESHOLD: DISCOUNT_THRESHOLD,
    DISCOUNT_AMOUNT: DISCOUNT_AMOUNT,
    findProduct: findProduct,
    filterProducts: filterProducts,
};
