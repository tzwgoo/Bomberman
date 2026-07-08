export type BombermanMapOption = {
    id: string;
    name: string;
    description: string;
    difficulty: string;
    recommendedPlayers: string;
    previewRows: string[];
};

export const BOMBERMAN_MAP_OPTIONS: BombermanMapOption[] = [
    {
        id: "random",
        name: "随机地图",
        description: "由服务端从全部地图中随机选择。",
        difficulty: "随机",
        recommendedPlayers: "2-4",
        previewRows: ["????????", "????????", "????????", "????????", "????????", "????????", "????????"],
    },
    {
        id: "classic",
        name: "经典工厂",
        description: "标准箱子密度，适合快速上手。",
        difficulty: "普通",
        recommendedPlayers: "2-4",
        previewRows: ["########", "#..x...#", "#.#.#x.#", "#x...x.#", "#.#.#..#", "#...x..#", "########"],
    },
    {
        id: "crossfire",
        name: "十字火线",
        description: "中线掩体更多，抢中路风险更高。",
        difficulty: "困难",
        recommendedPlayers: "3-4",
        previewRows: ["########", "#..x...#", "#.#x#x.#", "#xxx#xx#", "#.#x#x.#", "#...x..#", "########"],
    },
    {
        id: "warehouse",
        name: "仓库通道",
        description: "纵向通道更明显，适合绕后和卡位。",
        difficulty: "进阶",
        recommendedPlayers: "2-4",
        previewRows: ["########", "#..#...#", "#x.#.x.#", "#x...x.#", "#x.#.x.#", "#...#..#", "########"],
    },
    {
        id: "open-yard",
        name: "开阔庭院",
        description: "箱子更少，移动空间更大。",
        difficulty: "简单",
        recommendedPlayers: "2-3",
        previewRows: ["########", "#......#", "#.#.#..#", "#..x...#", "#..#.#.#", "#......#", "########"],
    },
    {
        id: "fortress",
        name: "环形堡垒",
        description: "外围路线安全，中部争夺更激烈。",
        difficulty: "困难",
        recommendedPlayers: "4",
        previewRows: ["########", "#..x...#", "#.####.#", "#.#xx#.#", "#.####.#", "#...x..#", "########"],
    },
    {
        id: "river-crossing",
        name: "河道断桥",
        description: "中路桥口狭窄，适合埋伏和反打。",
        difficulty: "进阶",
        recommendedPlayers: "2-4",
        previewRows: ["########", "#..x...#", "#.#x#..#", "#xx...x#", "#..#x#.#", "#...x..#", "########"],
    },
    {
        id: "four-corners",
        name: "四角擂台",
        description: "四角出生更均衡，中部资源争夺明显。",
        difficulty: "普通",
        recommendedPlayers: "4",
        previewRows: ["########", "#..x..x#", "#.#.#..#", "#x..x.x#", "#..#.#.#", "#x..x..#", "########"],
    },
    {
        id: "maze-garden",
        name: "迷宫花园",
        description: "小路更多，适合绕后和预判封路。",
        difficulty: "困难",
        recommendedPlayers: "3-4",
        previewRows: ["########", "#..#x..#", "#x.#.#x#", "#..x...#", "#x#.#.x#", "#..x#..#", "########"],
    },
    {
        id: "power-core",
        name: "能量核心",
        description: "中心区域更开放，适合抢节奏和连环爆破。",
        difficulty: "进阶",
        recommendedPlayers: "2-4",
        previewRows: ["########", "#..x...#", "#.#....#", "#x..x.x#", "#.#....#", "#...x..#", "########"],
    },
    {
        id: "rush-lane",
        name: "疾走长廊",
        description: "横向长通道明显，节奏更快。",
        difficulty: "进阶",
        recommendedPlayers: "2",
        previewRows: ["########", "#......#", "#x#x#x.#", "#......#", "#.#x#x.#", "#......#", "########"],
    },
];
