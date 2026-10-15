# Component logos

Every component in the catalog shows a logo tile in the builder, the release lists, the fork
matrix and the landing page. Files live in `apps/web/public/logos/`; `apps/web/lib/logos.ts`
maps each component slug to a file.

## Adding or replacing a logo

1. Save the image as `apps/web/public/logos/<component-slug>.svg` (or `.png`, `.webp`, `.jpg`).
   The slug is the `slug:` field in `catalog/components/*.yaml`.
2. Reload the page. A file named after the slug always wins over the shared mapping, so no code
   change is needed. Production picks it up on the next deploy.

Guidelines:

- Square, at least 128 × 128 px. SVG is best; PNGs are shown at up to 64 px.
- Transparent background: the mark is padded on a white tile.
- If the logo has its own opaque square background, add the file name to `BLEED` in
  `apps/web/lib/logos.ts` so it fills the tile edge to edge instead of being padded.
- Prefer the project's own artwork (its repository, docs site or brand kit).

## Not found yet

These components still show a monogram tile. Their maintainers are individuals and there was no
project logo to use.

| Component | Slug (file name) | Repository |
|---|---|---|
| mev-rs | `mev-rs` | [ralexstokes/mev-rs](https://github.com/ralexstokes/mev-rs) |
| eth-duties | `eth-duties` | [TobiWo/eth-duties](https://github.com/TobiWo/eth-duties) |
| ETHDuties Tracker | `ethduties` | [shayanb/ethduties](https://github.com/shayanb/ethduties) |
| eth-docker-ansible | `eth-docker-ansible` | [yorickdowne/eth-docker-ansible](https://github.com/yorickdowne/eth-docker-ansible) |
| eth2-val-tools | `eth2-val-tools` | [protolambda/eth2-val-tools](https://github.com/protolambda/eth2-val-tools) |
| Diva Operator | `diva-operator` | [ShamirLabs/diva-alpha-net](https://github.com/ShamirLabs/diva-alpha-net) |

## Borrowed from the vendor or project

These use their organisation's logo because no product-specific mark was found. Drop a
`<slug>` file in to replace any of them.

| Components | Logo used |
|---|---|
| `eth-docker`, `ethstaker-deposit-cli`, `ethstaker-guides` | EthStaker |
| `vouch`, `dirk` | Attestant |
| `vero` | Serenita |
| `caplin` | Erigon |
| `beaconchain-explorer` | Bitfly |
| `charon-distributed-validator-node`, `obol-monitoring`, `lido-dv-exit` | Obol |
| `ssv-dkg` | SSV Network |
| `mev-boost-relay` | Flashbots |
| `ethereum-metrics-exporter`, `dora`, `checkpointz`, `contributoor` | ethPandaOps |
| `ethereum-validators-monitoring`, `lido-simple-dvt`, `validator-ejector`, `lido-keys-api` | Lido |
| `prysm-web-ui` | Prysm |
| `ethdo`, `ethereal` | Weald Technology |
| `staking-deposit-cli`, specs and `eth-clients-*` network configs | Ethereum |

## Sources

Logos are trademarks of their projects and are used only to identify them. Raster files were
resized to at most 192 px and colour-quantised; SVGs were stripped of metadata.

| File | Source |
|---|---|
| `anchor.png` | https://anchor.sigmaprime.io/anchor-logo.png |
| `attestant.png` | GitHub avatar of [attestantio](https://github.com/attestantio) |
| `besu.png` | [clientdiversity.org](https://github.com/etheralpha/clientdiversity-org/blob/main/assets/img/execution-clients/besu-logo.png) |
| `bitfly.png` | GitHub avatar of [gobitfly](https://github.com/gobitfly) |
| `coincashew.png` | GitHub avatar of [coincashew](https://github.com/coincashew) |
| `commit-boost.png` | https://commit-boost.github.io/commit-boost-client/img/icon.png |
| `dappnode.png` | GitHub avatar of [dappnode](https://github.com/dappnode) |
| `eigenlayer.png` | GitHub avatar of [Layr-Labs](https://github.com/Layr-Labs) |
| `ephemery.png` | GitHub avatar of [ephemery-testnet](https://github.com/ephemery-testnet) |
| `erigon.png` | GitHub avatar of [erigontech](https://github.com/erigontech) |
| `ethereum-on-arm.png` | GitHub avatar of [diglos](https://github.com/diglos) (the Ethereum on ARM mark) |
| `ethereum.png` | GitHub avatar of [ethereum](https://github.com/ethereum) |
| `ethpandaops.png` | GitHub avatar of [ethpandaops](https://github.com/ethpandaops) |
| `ethrex.png` | [lambdaclass/ethrex](https://github.com/lambdaclass/ethrex/blob/main/assets/ethrex_favicon_192x192.png) |
| `ethstaker.png` | GitHub avatar of [eth-educators](https://github.com/eth-educators) |
| `flashbots.png` | GitHub avatar of [flashbots](https://github.com/flashbots) |
| `geth.png` | [clientdiversity.org](https://github.com/etheralpha/clientdiversity-org/blob/main/assets/img/execution-clients/geth-logo.png) |
| `grafana.png` | GitHub avatar of [grafana](https://github.com/grafana) |
| `grandine.svg` | https://grandine.io site logo, mark only |
| `kiln.png` | GitHub avatar of [kilnfi](https://github.com/kilnfi) |
| `lido.png` | GitHub avatar of [lidofinance](https://github.com/lidofinance) |
| `lighthouse.png` | [clientdiversity.org](https://github.com/etheralpha/clientdiversity-org/blob/main/assets/img/consensus-clients/lighthouse-logo-original.png) |
| `lodestar.png` | [ChainSafe/lodestar](https://github.com/ChainSafe/lodestar/blob/unstable/assets/lodestar_icon_300.png) |
| `nethermind.png` | GitHub avatar of [NethermindEth](https://github.com/NethermindEth) |
| `nicenode.png` | GitHub avatar of [NiceNode](https://github.com/NiceNode) |
| `nimbus.png` | [clientdiversity.org](https://github.com/etheralpha/clientdiversity-org/blob/main/assets/img/consensus-clients/nimbus-logo.png) |
| `nodeset.png` | GitHub avatar of [nodeset-org](https://github.com/nodeset-org) |
| `obol.png` | GitHub avatar of [ObolNetwork](https://github.com/ObolNetwork) |
| `prometheus.png` | GitHub avatar of [prometheus](https://github.com/prometheus) |
| `prysm.svg` | [clientdiversity.org](https://github.com/etheralpha/clientdiversity-org/blob/main/assets/img/consensus-clients/prysm-logo.svg) |
| `puffer.png` | GitHub avatar of [PufferFinance](https://github.com/PufferFinance) |
| `reth.png` | https://reth.rs/logo.png |
| `rocket-pool.png` | GitHub avatar of [rocket-pool](https://github.com/rocket-pool) |
| `sedge.svg` | [NethermindEth/sedge](https://github.com/NethermindEth/sedge) README logo, mark only |
| `serenita.png` | https://serenita.io/apple-touch-icon.png |
| `siren.png` | [sigp/siren](https://github.com/sigp/siren/blob/HEAD/public/siren.png) |
| `ssv.png` | https://ssv.network site icon |
| `stakewise.png` | GitHub avatar of [stakewise](https://github.com/stakewise) |
| `stereum.png` | GitHub avatar of [stereum-dev](https://github.com/stereum-dev) |
| `teku.png` | [clientdiversity.org](https://github.com/etheralpha/clientdiversity-org/blob/main/assets/img/consensus-clients/teku-logo-original.png) |
| `wagyu.png` | [stake-house/wagyu-key-gen](https://github.com/stake-house/wagyu-key-gen/blob/HEAD/static/icon.png) |
| `weald.png` | GitHub avatar of [wealdtech](https://github.com/wealdtech) |
| `web3signer.png` | https://docs.web3signer.consensys.io/img/favicon.ico |
