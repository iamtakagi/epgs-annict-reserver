/* ref: https://github.com/rinsuki/sanime */

import got from "got"
import { z } from "zod"

// 上の方が強い
export const WATCH_STATUS = [
    "REPEATING", // 再視聴中
    "WATCHED", // 視聴完了
    "WATCHING", // 視聴中
    "PAUSED", // 一時中断中
    "WANT", // 視聴したい
    "DROPPED", // 視聴断念
] as const

export function statusScore(status: WatchStatus, season: SeasonStruct | undefined | null) {
    if (status === "DROPPED") {
        return -1
    } else if (
        status === "REPEATING" ||
        status === "WATCHED" ||
        (status === "WATCHING" && season != null && isNearCurrentOrAfterSeason(season))
    ) {
        return 10
    } else {
        return WATCH_STATUS.length - WATCH_STATUS.indexOf(status) - 1
    }
}

export interface SeasonStruct {
    year: number
    name: Season | null
}

/**
 * だいたい今期以降のシーズンかを判定する。
 * watchingをwatched判定として扱うかに利用する
 */
export function isNearCurrentOrAfterSeason(season: SeasonStruct) {
    let month: number
    switch (season.name) {
        case null:
            month = 1
            break
        case "WINTER":
            month = 1
            break
        case "SPRING":
            month = 4
            break
        case "SUMMER":
            month = 7
            break
        case "AUTUMN":
            month = 11
            break
    }
    if (month == null) throw new Error("never happened!")
    month-- // JavaScript Date's month is 0-indexed
    // ひょっとするとフライングするアニメもあるかもしれないので2週間くらい早めに判定しておく
    const startDate = new Date(season.year, month, -14)
    const endDate = new Date(
        season.year,
        // シーズン名が指定されていなかったら1年中あるものだということにする
        // TODO: 連続2クールのことをちゃんと考える (でもシーズン情報だけだとどうしようもない？)
        season.name == null ? 11 : month + 3,
        // いろいろなことがあって次シーズンに被ることがあるので、だいたい2週間くらいは多めに見る
        // 例: 式守さんは2022年春アニメだが7月10日に12話予定
        //     さらに最速以外の配信サイトは5日遅れなので15日だが…まあ1日くらいは気にしないことにする
        14,
    )
    const current = Date.now()
    return current > startDate.getTime() && endDate.getTime() > current
}

export function calcStatusScore(
    statuses: { status: WatchStatus }[],
    season: SeasonStruct | undefined | null,
) {
    let score = 0
    for (const s of statuses) {
        score += statusScore(s.status, season)
    }
    return score
}

export type ServiceID = `mal:${string}` | `annict:${string}` | `anilist:${string}`

export type WatchStatus = typeof WATCH_STATUS[number]

export interface AnimeStatus {
    sourceServiceID: ServiceID
    myAnimeListID?: number
    status: WatchStatus
}

export interface UserAnimeStatus {
    id: ServiceID
    avatarUrl?: string
    works: AnimeStatus[]
}

export function idToURL(id: ServiceID) {
    if (id.startsWith("mal:")) {
        return `https://myanimelist.net/anime/${id.split(":")[1]}`
    } else if (id.startsWith("annict:")) {
        return `https://annict.com/works/${id.split(":")[1]}`
    } else if (id.startsWith("anilist:")) {
        return `https://anilist.co/anime/${id.split(":")[1]}`
    }
}

export function malIdIfPossible(status: AnimeStatus): ServiceID {
    if (status.myAnimeListID != null) {
        return `mal:${status.myAnimeListID}` as const
    } else {
        return status.sourceServiceID
    }
}

export const ANIME_TYPE = ["TV", "MOVIE", "OVA", "ONA", "OTHERS"] as const

export type AnimeType = typeof ANIME_TYPE[number]

export const SEASONS = ["WINTER", "SPRING", "SUMMER", "AUTUMN"] as const
export type Season = typeof SEASONS[number]

export const READABLE_SEASON: Record<Season, string> = {
    WINTER: "冬",
    SPRING: "春",
    SUMMER: "夏",
    AUTUMN: "秋",
}

export interface AnimeInfo {
    id: ServiceID
    idMal?: number
    idAnnict?: number
    idAniList?: number
    title?: string
    horizontalCoverURL?: string
    verticalCoverURL?: string
    type: AnimeType | null
    season: {
        year: number
        name: Season | null
    } | null
}


const annictMedia = ["TV", "OVA", "MOVIE", "WEB", "OTHER"] as const

const zWork = z.object({
    annictId: z.number(),
    title: z.string(),
    malAnimeId: z.nullable(z.string()),
    seasonName: z.nullable(z.enum(["WINTER", "SPRING", "SUMMER", "AUTUMN"])),
    seasonYear: z.nullable(z.number()),
    image: z.nullable(
        z.object({
            facebookOgImageUrl: z.nullable(z.string()),
        }),
    ),
    media: z.nullable(z.enum(annictMedia)),
})

const annictMediaToSharedType: { [key in typeof annictMedia[number]]: AnimeType } = {
    TV: "TV",
    OVA: "OVA",
    MOVIE: "MOVIE",
    WEB: "ONA",
    OTHER: "OTHERS",
}

export function resToInfo(work: z.infer<typeof zWork>): AnimeInfo {
    if (work.seasonYear == null && work.seasonName != null)
        throw new Error("why is seasonYear null?")
    return {
        id:
            work.malAnimeId != null
                ? (`mal:${work.malAnimeId}` as const)
                : (`annict:${work.annictId}` as const),
        idMal: work.malAnimeId != null ? parseInt(work.malAnimeId, 10) : undefined,
        idAnnict: work.annictId,
        title: work.title,
        horizontalCoverURL: work.image?.facebookOgImageUrl ?? undefined,
        type: work.media != null ? annictMediaToSharedType[work.media] : null,
        season:
            work.seasonYear != null
                ? {
                      year: work.seasonYear,
                      name: work.seasonName,
                  }
                : null,
    }
}

export async function fetchAnnictAnimes(
    annictIds: number[],
    _cacheAlreadyChecked = false,
): Promise<AnimeInfo[]> {
    if (annictIds.length === 0) return []
    if (annictIds.length > 50) {
        const arr = []
        for (let i = 0; i < annictIds.length; i += 50) {
            arr.push(...(await fetchAnnictAnimes(annictIds.slice(i, i + 50), true)))
        }
        return arr
    }

    let query = "query ($ids: [Int!]) { works: searchWorks( annictIds: $ids ) { nodes {\n"
    query += "annictId\n"
    query += "title\n"
    query += "malAnimeId\n"
    query += "seasonName\n"
    query += "seasonYear\n"
    query += "image { facebookOgImageUrl }\n"
    query += "media\n"
    query += "} } }"

    const res = await got.post<{ data: unknown }>("https://api.annict.com/graphql", {
        body: JSON.stringify({
            query,
            variables: {
                ids: annictIds,
            },
        }),
        headers: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "Authorization": `Bearer ${process.env.ANNICT_TOKEN!}`,
            "Content-Type": "application/json",
        },
        responseType: "json",
    })

    console.log(res.body)

    const data = z
        .object({
            works: z.object({
                nodes: z.array(zWork),
            }),
        })
        .parse(res.body.data)

    const works = data.works.nodes
    if (works.length < 1) return []
    return works.map(resToInfo)
}

const zAnnictWatchStatus = z
    .literal("WANNA_WATCH")
    .or(z.literal("WATCHING"))
    .or(z.literal("WATCHED"))
    .or(z.literal("ON_HOLD"))
    .or(z.literal("STOP_WATCHING"))

type AnnictWatchStatus = z.infer<typeof zAnnictWatchStatus>

const annictToShared: Record<AnnictWatchStatus, WatchStatus> = {
    WANNA_WATCH: "WANT",
    WATCHING: "WATCHING",
    WATCHED: "WATCHED",
    ON_HOLD: "PAUSED",
    STOP_WATCHING: "DROPPED",
}

const ANNICT_WATCH_STATUS = Object.keys(annictToShared) as AnnictWatchStatus[]

export const zAnnictWorks = z.object({
    nodes: z.array(
        z.object({
            annictId: z.number(),
            malAnimeId: z.nullable(z.string()),
        }),
    ),
})

function generateZAnnictUserWorks() {
    const obj: Partial<Record<AnnictWatchStatus, undefined | typeof zAnnictWorks>> = {}
    for (const status of ANNICT_WATCH_STATUS) {
        obj[status] = zAnnictWorks
    }

    return obj as Record<AnnictWatchStatus, typeof zAnnictWorks>
}

const zAnnictUser = z.object({
    username: z.string(),
    avatarUrl: z.string(),
    ...generateZAnnictUserWorks(),
})

export async function fetchAnnictWatchesRaw(users: string[]): Promise<z.infer<typeof zAnnictUser>[]> {
    if (users.length === 0) return []

    let query = `query (${users.map((_, i) => `$u${i}: String!`).join(", ")}) {\n`
    for (const i of users.keys()) {
        query += `u${i}: user(username: $u${i}) { ...userObj }\n`
    }
    query += "}\n"
    query += "fragment userObj on User {\n"
    query += "username\n"
    query += "avatarUrl\n"
    for (const state of ANNICT_WATCH_STATUS) {
        query += `${state}: works(state: ${state}) { nodes { ...workIds } }\n`
    }
    query += "}\n"
    query += "fragment workIds on Work {\nannictId\nmalAnimeId\n}"
    console.log(query)
    const annictRes = await got.post<{ data: unknown }>("https://api.annict.com/graphql", {
        body: JSON.stringify({
            query,
            variables: users.reduce<Record<string, string>>((obj, user, i) => {
                obj[`u${i}`] = user
                return obj
            }, {}),
        }),
        headers: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "Authorization": `Bearer ${process.env.ANNICT_TOKEN!}`,
            "Content-Type": "application/json",
        },
        responseType: "json",
    })

    const data = z.record(z.string(), zAnnictUser).parse(annictRes.body.data)
    return Object.values(data)
}