import {
  fetchAnnictAnimes,
  fetchAnnictWatchesRaw,
  zAnnictWorks,
} from "./annict.js"
import { z } from "zod"
import { addRule } from "./epgstation.js"

;(async () => {
  // fetch: Annict User を取得
  const user = (await fetchAnnictWatchesRaw([process.env.ANNICT_USER!]))[0]

  // join: WANNA_WATCH と WATCHING を抽出 + 連結
  const obj = z.object({
    annictId: z.number(),
    malAnimeId: z.nullable(z.string()),
  })
  const annictWorkIds = [
    ...user.WANNA_WATCH.nodes.map(({ annictId }: z.infer<typeof obj>) => annictId),
    ...user.WATCHING.nodes.map(
      ({ annictId }: z.infer<typeof obj>) => annictId
    ),
  ]
  console.log("annictWorkIds: " + annictWorkIds)

  // fetch: 作品情報を取得
  const annictWorks = await fetchAnnictAnimes(annictWorkIds)
  console.log(annictWorks)

  // filter: 放映作品と劇場作品を抽出
  const filteredAnnictWorks = annictWorks.filter(
    (work) => work.type === "TV" || work.type === "MOVIE"
  )
  console.log(filteredAnnictWorks)

  // reserve: EPGStation に予約ルールを追加
  for (const { title } of filteredAnnictWorks) {
    if (!title) continue
    const res = await addRule({
      isTimeSpecification: true,
      searchOption: {
        description: true,
        extended: false,
        keyCS: false,
        keyRegExp: false,
        keyword: title,
        name: true,
        times: [
          {
            week: 127,
          },
        ],
      },
      reserveOption: {
        enable: true, // ルールが有効か
        allowEndLack: true, // 末尾切れを許可するか
        avoidDuplicate: false, // 録画済みの重複番組を排除するか
      },
      saveOption: {
        parentDirectoryName: process.env.RECORD_PARENT_DIR!, // 親保存ディレクトリ
        directory: title, // 保存ディレクトリ
        recordedFormat: "TS", // ファイル名フォーマット
      },
    })
    console.log(res)
  }
})()
