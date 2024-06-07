// script.ts
import JSZip from "jszip"
import { csv2json } from "csv42"
import fse from "fs-extra"
const addressURL =
  "https://www.post.japanpost.jp/zipcode/dl/utf/zip/utf_ken_all.zip"

const arrayBuffer = await fetch(addressURL).then((res) => res.arrayBuffer())
const csvString = await JSZip.loadAsync(arrayBuffer).then((zip) =>
  zip.file("utf_ken_all.csv")?.async("string")
)
if (!csvString) {
  throw new Error("csv not found.")
}
// 以下は一旦無視
// 一町域が二以上の郵便番号で表される場合の表示　（※3）　（「1」は該当、「0」は該当せず）
// 小字毎に番地が起番されている町域の表示　（※4）　（「1」は該当、「0」は該当せず）
// 丁目を有する町域の場合の表示　（「1」は該当、「0」は該当せず）
// 一つの郵便番号で二以上の町域を表す場合の表示　（※5）　（「1」は該当、「0」は該当せず）
// 更新の表示（※6）（「0」は変更なし、「1」は変更あり、「2」廃止（廃止データのみ使用））
// 変更理由　（「0」は変更なし、「1」市政・区政・町政・分区・政令指定都市施行、「2」住居表示の実施、「3」区画整理、「4」郵便区調整等、「5」訂正、「6」廃止（廃止データのみ使用））

type AddressField = {
  lg_code: number
  old_postcode: number
  postcode: number
  prefecture_full_char: string
  city_full_char: string
  town_full_char: string
  prefecture_kanji: string
  city_kanji: string
  town_kanji: string
}
const csvHeader = [
  "lg_code",
  "old_postcode",
  "postcode",
  "prefecture_full_char",
  "city_full_char",
  "town_full_char",
  "prefecture_kanji",
  "city_kanji",
  "town_kanji",
  "",
  "",
  "",
  "",
  "",
].join(",")
const addressRecords = csv2json<AddressField>(`${csvHeader}\r\n${csvString}`)

// Promise.allを最適化する必要あり
// const prefectures = addressRecords.map((record) => record.prefecture_kanji)
const prefectures = ["東京都"]

await Promise.all(
  prefectures.map(async (prefecture) => {
    const prefectureRecords = addressRecords.filter(
      ({ prefecture_kanji }) => prefecture_kanji === prefecture
    )
    const cities = prefectureRecords.map((record) => record.city_kanji)
    const addressMapRecords = cities.map((city) => {
      const cityRecords = prefectureRecords.filter(
        (record) => record.city_kanji === city
      )
      const cityAddressMap = cityRecords.reduce((acc, record) => {
        acc[record.town_kanji] = record.postcode
        return acc
      }, {} as Record<string, number>)
      return { key: city, value: cityAddressMap }
    })
    await Promise.all(
      addressMapRecords.map(
        async ({ key, value }) =>
          await fse.outputFile(
            `dist/${prefecture}/${key}.ts`,
            `export default ${JSON.stringify(value, null, 2)} as const`
          )
      )
    )
  })
)
