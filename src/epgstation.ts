import * as apid from './epgstation.d.js'
import fetch from 'node-fetch'

export const addRule = async (rule: apid.AddRuleOption) => {
    const base = process.env.EPGSTATION_URL!
    const path = '/api/rules';
    const url = new URL(path, base);
    const response = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify(rule),
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': `application/json`
        }
    })
    return response
}