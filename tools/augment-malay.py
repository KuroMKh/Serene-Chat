"""Create human-reviewable Malay/Manglish training variants with Mesolitica NanoT5.

Generated rows are deliberately marked reviewed=false. Review them manually and
change the value to true before passing the CSV to the classifier trainer.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import torch
from transformers import AutoTokenizer, T5ForConditionalGeneration


DEFAULT_MODEL = "mesolitica/nanot5-small-malaysian-translation-v2.1"
VALID_LABELS = {"suicide", "non-suicide"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate reviewed Malay/Manglish dataset candidates.")
    parser.add_argument("--input", default="training-data/malay-seed.csv")
    parser.add_argument("--output", default="training-data/malay-augmented.csv")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--targets", default="Melayu,Manglish,pasar Melayu")
    parser.add_argument("--variants", type=int, default=2)
    parser.add_argument("--max-length", type=int, default=160)
    return parser.parse_args()


def read_rows(filename: Path) -> list[dict[str, str]]:
    with filename.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    cleaned: list[dict[str, str]] = []
    for number, row in enumerate(rows, start=2):
        text = str(row.get("text", "")).strip()
        label = str(row.get("class", "")).strip().lower()
        if not text or label not in VALID_LABELS:
            raise ValueError(f"Invalid text/class at {filename}:{number}")
        cleaned.append({"text": text, "class": label})
    if not cleaned:
        raise ValueError(f"No rows found in {filename}")
    return cleaned


def generate_variants(
    text: str,
    target: str,
    tokenizer: AutoTokenizer,
    model: T5ForConditionalGeneration,
    device: torch.device,
    count: int,
    max_length: int,
) -> list[str]:
    prompt = f"terjemah ke {target}: {text}{tokenizer.eos_token}"
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True).to(device)
    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_length=max_length,
            do_sample=True,
            top_p=0.95,
            top_k=50,
            temperature=0.9,
            num_return_sequences=count,
        )
    return [value.strip() for value in tokenizer.batch_decode(outputs, skip_special_tokens=True) if value.strip()]


def main() -> None:
    args = parse_args()
    if args.variants < 1:
        raise ValueError("--variants must be at least 1")

    input_path = Path(args.input)
    output_path = Path(args.output)
    targets = [value.strip() for value in args.targets.split(",") if value.strip()]
    rows = read_rows(input_path)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading {args.model} on {device}...")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = T5ForConditionalGeneration.from_pretrained(args.model).to(device)
    model.eval()

    output_rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for index, row in enumerate(rows, start=1):
        original_key = (row["text"].casefold(), row["class"])
        if original_key not in seen:
            seen.add(original_key)
            output_rows.append({**row, "source": "human-seed", "reviewed": "true"})

        for target in targets:
            for generated in generate_variants(
                row["text"], target, tokenizer, model, device, args.variants, args.max_length
            ):
                key = (generated.casefold(), row["class"])
                if key in seen:
                    continue
                seen.add(key)
                output_rows.append(
                    {
                        "text": generated,
                        "class": row["class"],
                        "source": f"mesolitica-{target}",
                        "reviewed": "false",
                    }
                )
        print(f"Generated {index}/{len(rows)} seed rows")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["text", "class", "source", "reviewed"])
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Saved {len(output_rows)} candidates to {output_path}")
    print("Review generated rows and change reviewed=false to reviewed=true before training.")


if __name__ == "__main__":
    main()
