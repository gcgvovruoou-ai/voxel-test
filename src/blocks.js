export const BLOCKS = {
  grass:{color:0x62a83b, hardness:0.7}, dirt:{color:0x80502c,hardness:0.5},
  stone:{color:0x858585,hardness:1.5}, wood:{color:0x80552c,hardness:1},
  leaves:{color:0x287d32,hardness:0.25}, sand:{color:0xd8c17b,hardness:0.4},
  planks:{color:0xb4824a,hardness:0.8}, cobble:{color:0x666666,hardness:1.3}
};
export const ITEMS = ["pickaxe","axe","grass","dirt","stone","wood","leaves","sand","planks"];
export const TOOL_NAMES = {pickaxe:"Кирка",axe:"Топор"};
export function blockAt(x,y,z){return [Math.floor(x),Math.floor(y),Math.floor(z)].join(",");}
