// 補上 opencc-js subpath import 的型別。
// @types/opencc-js 只宣告了 main entry,沒涵蓋 'opencc-js/t2cn' 這條 subpath。
// 我們挑 subpath 是為了把 bundle 從 ~1MB 壓到 ~64KB(只載 Traditional → Simplified 字典)。
declare module 'opencc-js/t2cn' {
  export { Converter, CustomConverter } from 'opencc-js'
}
