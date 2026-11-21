"""本地提示词翻译服务（Qwen2.5-7B-Instruct，4bit 量化）。

============================================================================
为什么需要它
============================================================================

换人/生成流程要求英文结构化提示词，但使用者常写中文，云端 AI 普遍拒绝
处理 NSFW 内容。本服务只做「格式整理 + 翻译」，不做内容创作 —— 输入是
用户已经写好的文本，模型只负责拆字段和逐句翻译。

============================================================================
进程模型
============================================================================

由 Node 侧按需拉起（`compile` 时），用完即退，**常驻会白占 2GB 显存**。
通信走 stdin/stdout 的单行 JSON，不用 HTTP 端口 —— 省掉端口冲突和
防火墙问题，也让"拉起-用完-退出"变成一次进程生命周期。
"""
import json
import os
import sys

MODEL_ID = os.environ.get("JZ_PROMPT_MODEL", "Qwen/Qwen2.5-7B-Instruct")
# 4bit 量化：7B 从 ~15GB 降到 ~5GB，画质损失可忽略（只做翻译）
LOAD_IN_4BIT = os.environ.get("JZ_PROMPT_4BIT", "1") != "0"

_SYSTEM = (
    "You are a strict format converter and translator, not a writer.\n"
    "Your job: take the user's raw notes about a video editing task and "
    "rewrite them into a fixed English structure.\n"
    "Rules:\n"
    "1. Do NOT add new content, do NOT remove content, do NOT judge or comment.\n"
    "2. Translate every Chinese sentence into plain English.\n"
    "3. Keep every placeholder token EXACTLY as written: <Subject N>, "
    "<Video N>, <Picture N>, and any trigger phrase the user supplied.\n"
    "4. Output ONLY the rewritten text. No preamble, no explanation, "
    "no markdown fences.\n"
    "5. If a line is already English, keep it as-is.\n"
)


def load_model():
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tok = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    kwargs = {"device_map": "auto", "trust_remote_code": True}
    if LOAD_IN_4BIT:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_quant_type="nf4",
        )
    else:
        kwargs["torch_dtype"] = torch.float16
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID, **kwargs)
    model.eval()
    return tok, model


def generate(tok, model, user_text, max_new_tokens=900):
    import torch

    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": user_text},
    ]
    prompt = tok.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tok([prompt], return_tensors="pt").to(model.device)
    with torch.inference_mode():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,          # 翻译要确定性，不要随机采样
            temperature=None,
            top_p=None,
            pad_token_id=tok.eos_token_id,
        )
    gen = out[0][inputs["input_ids"].shape[1]:]
    return tok.decode(gen, skip_special_tokens=True).strip()


def main():
    """stdin 每行一个 JSON 请求，stdout 每行一个 JSON 响应。

    请求:  {"id": "...", "text": "..."}
    响应:  {"id": "...", "ok": true, "text": "..."}
           或 {"id": "...", "ok": false, "error": "..."}
    """
    def reply(obj):
        sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    try:
        tok, model = load_model()
    except Exception as e:
        reply({"id": None, "ok": False, "error": f"MODEL_LOAD_FAILED: {e}"})
        return 1

    reply({"id": None, "ok": True, "ready": True, "model": MODEL_ID})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception as e:
            reply({"id": None, "ok": False, "error": f"BAD_JSON: {e}"})
            continue

        rid = req.get("id")
        text = str(req.get("text") or "")
        if not text.strip():
            reply({"id": rid, "ok": False, "error": "EMPTY_TEXT"})
            continue
        try:
            out = generate(tok, model, text)
            reply({"id": rid, "ok": True, "text": out})
        except Exception as e:
            reply({"id": rid, "ok": False, "error": f"GENERATE_FAILED: {e}"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
