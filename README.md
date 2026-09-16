# Personal tools

Small tools that can run locally.

## Car calculator

[Car calculator documentation](car-calculator/README.md)

Compares a balloon loan, standard loan, operating lease and outright purchase, including resale, VAT timing and opportunity cost.

Open `car-calculator/car-financing-calculator.html` directly in a browser. The HTML file works offline and can be shared on its own.

## Development

Node.js 20 or later is needed to build and run the checks. No package installation is required.

From this repository:

```sh
node car-calculator/build.mjs
node car-calculator/test.mjs
```

Each tool lives in its own directory. See [AGENTS.md](AGENTS.md) before editing.
