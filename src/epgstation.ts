import * as apid from './epgstation.d.js'
import got from 'got'

export const addRule = async (rule: apid.AddRuleOption) => {
    const epgsRes = await got.post<{ data: unknown }>(`${process.env.EPGSTATION_URL!}/api/rules`, {
        body: JSON.stringify(rule),
        headers: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "Content-Type": "application/json",
        },
        responseType: "json",
    })
    return epgsRes
}