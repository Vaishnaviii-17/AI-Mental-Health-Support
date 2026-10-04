import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM


MODEL_NAME = "facebook/nllb-200-distilled-600M"

LANG_MAP = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "mr": "mar_Deva",
}


class NLLBTranslator:
    """
    Local NLLB-200 translator.

    Supported application language codes:
        en -> English
        hi -> Hindi
        mr -> Marathi

    Translation target:
        English
    """

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        print()
        print("=" * 60)
        print("Initializing NLLB-200 translation model")
        print(f"Model: {MODEL_NAME}")
        print(f"Device: {self.device}")

        if self.device == "cuda":
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            print(f"PyTorch CUDA: {torch.version.cuda}")

        print("=" * 60)

        print("Loading NLLB tokenizer...")

        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME
        )

        self.dtype = (
            torch.float16
            if self.device == "cuda"
            else torch.float32
        )

        print(
            f"Loading NLLB model with dtype={self.dtype}..."
        )

        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=self.dtype,
        )

        self.model.to(self.device)
        self.model.eval()

        print("NLLB translation model loaded successfully.")
        print("=" * 60)
        print()

    def translate_to_english(
        self,
        text: str,
        source_language: str
    ) -> str:
        """
        Translate Hindi or Marathi text into English.

        English text is returned unchanged.

        Args:
            text:
                Input text.

            source_language:
                Application language code:
                    en
                    hi
                    mr

        Returns:
            English text.

        Raises:
            ValueError:
                Invalid input or unsupported language.

            RuntimeError:
                Translation/model failure.
        """

        # -----------------------------------------------------
        # Validate text
        # -----------------------------------------------------

        if not isinstance(text, str):
            raise ValueError(
                "Translation text must be a string."
            )

        text = text.strip()

        if not text:
            raise ValueError(
                "Translation text cannot be empty."
            )

        # -----------------------------------------------------
        # Validate / normalize source language
        # -----------------------------------------------------

        if not isinstance(source_language, str):
            raise ValueError(
                "Source language must be a string."
            )

        source_language = source_language.strip().lower()

        if source_language not in LANG_MAP:
            raise ValueError(
                f"Unsupported language: {source_language}. "
                "Supported languages are: en, hi, mr"
            )

        # -----------------------------------------------------
        # English bypass
        # -----------------------------------------------------

        if source_language == "en":
            print(
                "[NLLB] English input detected. "
                "Translation bypassed."
            )

            return text

        source_nllb_code = LANG_MAP[source_language]
        target_nllb_code = LANG_MAP["en"]

        # -----------------------------------------------------
        # Logging
        # -----------------------------------------------------

        print()
        print("-" * 60)
        print("[NLLB] Translation request")
        print(
            f"[NLLB] Source language: "
            f"{source_language}"
        )
        print(
            f"[NLLB] Source language code: "
            f"{source_nllb_code}"
        )
        print(
            f"[NLLB] Target language code: "
            f"{target_nllb_code}"
        )
        print(
            f"[NLLB] Device: "
            f"{self.device}"
        )
        print(
            f"[NLLB] Input: "
            f"{text}"
        )

        # -----------------------------------------------------
        # Configure tokenizer source language
        # -----------------------------------------------------

        self.tokenizer.src_lang = source_nllb_code

        # -----------------------------------------------------
        # Tokenize
        # -----------------------------------------------------

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        # -----------------------------------------------------
        # Resolve English target token
        # -----------------------------------------------------

        english_token_id = (
            self.tokenizer.convert_tokens_to_ids(
                target_nllb_code
            )
        )

        if (
            english_token_id is None
            or english_token_id
            == self.tokenizer.unk_token_id
        ):
            raise RuntimeError(
                "Unable to resolve NLLB English "
                "language token."
            )

        # -----------------------------------------------------
        # Generate translation
        # -----------------------------------------------------

        try:
            with torch.inference_mode():

                generated_tokens = self.model.generate(
                    **inputs,
                    forced_bos_token_id=english_token_id,
                    max_new_tokens=256,
                    num_beams=4,
                    early_stopping=True,
                )

        except torch.cuda.OutOfMemoryError as exc:

            if self.device == "cuda":
                torch.cuda.empty_cache()

            raise RuntimeError(
                "NLLB translation failed because GPU "
                "memory was exhausted."
            ) from exc

        except Exception as exc:

            raise RuntimeError(
                f"NLLB generation failed: {exc}"
            ) from exc

        # -----------------------------------------------------
        # Decode generated tokens
        # -----------------------------------------------------

        try:
            translated_text = (
                self.tokenizer.batch_decode(
                    generated_tokens,
                    skip_special_tokens=True,
                )[0]
                .strip()
            )

        except Exception as exc:

            raise RuntimeError(
                f"NLLB decoding failed: {exc}"
            ) from exc

        if not translated_text:
            raise RuntimeError(
                "NLLB returned an empty translation."
            )

        # -----------------------------------------------------
        # Success logging
        # -----------------------------------------------------

        print(
            f"[NLLB] Output: "
            f"{translated_text}"
        )

        if self.device == "cuda":

            allocated_mb = (
                torch.cuda.memory_allocated(0)
                / (1024 ** 2)
            )

            reserved_mb = (
                torch.cuda.memory_reserved(0)
                / (1024 ** 2)
            )

            print(
                f"[NLLB] GPU memory allocated: "
                f"{allocated_mb:.2f} MB"
            )

            print(
                f"[NLLB] GPU memory reserved: "
                f"{reserved_mb:.2f} MB"
            )

        print(
            "[NLLB] Translation completed successfully."
        )
        print("-" * 60)
        print()

        return translated_text