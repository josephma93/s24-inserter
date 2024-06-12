# CLI Tool for JW Hub Actions

This document provides instructions and examples for using the CLI tool to perform various actions on JW Hub. It also
includes ways to test and debug the program using `--inspect` and `--inspect-brk`.

## Prerequisites

Ensure you have the following installed:

- Node.js
- npm or yarn

## Running the Program

The CLI tool can be run with the following command:

```bash
node insert-s-24-record.mjs -a <action> -d <date> [options]
```

### Required Options

- `-a, --action <action>`: Action to perform (donation, deposit, payment, other).
- `-d, --date <date>`: Transaction date in `d/m/yyyy` format.

### Optional Parameters

- `-ww, --world-work-amount <amount>`: World Work amount.
- `-ce, --congregation-amount <amount>`: Congregation amount.
- `--debug`: Enable debug mode.

## Examples

### Example 1: Perform a Donation

```bash
node insert-s-24-record.mjs -a donation -d 22/5/2024 -ww 123 -ce 123 --debug
```

### Example 2: Perform a Deposit

```bash
node insert-s-24-record.mjs -a deposit -d 15/6/2024 -ww 200
```

### Example 3: Perform a Payment

```bash
node insert-s-24-record.mjs -a payment -d 10/7/2024
```

## Debugging the Program

You can debug the program using Node.js debugging options.

### Using `--inspect`

This option allows you to debug the program using an inspector. Run the following command:

```bash
node --inspect insert-s-24-record.mjs -a donation -d 22/5/2024 -ww 123 -ce 123 --debug
```

### Using `--inspect-brk`

This option allows you to break at the start of the program for debugging. Run the following command:

```bash
node --inspect-brk insert-s-24-record.mjs -a donation -d 22/5/2024 -ww 123 -ce 123 --debug
```

After running the above commands, open `chrome://inspect` in Google Chrome to start debugging.

## Help and Usage Information

To display help and usage information, run:

```bash
node insert-s-24-record.mjs --help
```

This will display the command usage, options, and examples provided in the CLI tool.

