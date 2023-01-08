# epgs-annict-reserver
![](https://img.shields.io/badge/code%20quality-needs%20refactoring-critical)

(wip) Annict の作品視聴ステータス「見てる」「見たい」を選択している放映作品と劇場作品のタイトルを EPGStation の録画ルールに自動追加してくれるツール\
実装自体は恐らく動くようになっていると思いますが、EPGStation 側で原因不明のエラー Internal Server Error: 500 が発生するので動きません (涙)

## Getting Started

### Installation
```
docker run --rm ghcr.io/iamtakagi/epgs-annict-reserver:latest
```

## LICENSE
MIT License\
Copyright (c) 2023 iamtakagi