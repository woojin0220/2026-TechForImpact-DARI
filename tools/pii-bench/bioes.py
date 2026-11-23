"""BIOES-constrained Viterbi for HF token logits, with zero transition biases.

Matches the structural policy and default zero biases documented by
https://github.com/openai/privacy-filter (f7f00ca7fb869683eb732c010299d901457f19c3).
This adapter uses the HF tokenizer/model, not the native OPF runtime.
"""
import torch


def decode(logits, id2label):
    tags = [id2label[i].split("-", 1) if id2label[i] != "O" else ["O", ""] for i in range(len(id2label))]
    size = len(tags)
    transition = torch.full((size, size), float("-inf"))
    start = torch.tensor([0. if tag in ["O", "B", "S"] else float("-inf") for tag, _ in tags])
    end = torch.tensor([0. if tag in ["O", "E", "S"] else float("-inf") for tag, _ in tags])
    for a, (previous, previous_label) in enumerate(tags):
        for b, (following, following_label) in enumerate(tags):
            allowed = (previous in ["O", "E", "S"] and following in ["O", "B", "S"]) or (
                previous in ["B", "I"] and following in ["I", "E"] and previous_label == following_label)
            if allowed:
                transition[a, b] = 0.
    emissions = logits.detach().float().cpu()
    if not len(emissions):
        return []
    score = emissions[0] + start
    history = []
    for emission in emissions[1:]:
        best, pointer = (score[:, None] + transition).max(dim=0)
        history.append(pointer)
        score = best + emission
    last = int((score + end).argmax())
    path = [last]
    for pointer in reversed(history):
        last = int(pointer[last])
        path.append(last)
    return list(reversed(path))


def spans_from_path(path, offsets, id2label, text):
    spans, begin = [], None
    for index, label_id in enumerate(path):
        label = id2label[label_id]
        if label == "O":
            continue
        tag, entity = label.split("-", 1)
        if tag in ["B", "S"]:
            begin = offsets[index][0]
        if tag in ["E", "S"] and begin is not None:
            finish = offsets[index][1]
            while begin < finish and text[begin].isspace():
                begin += 1
            while finish > begin and text[finish - 1].isspace():
                finish -= 1
            if finish > begin:
                spans.append({"start": begin, "end": finish, "label": entity})
            begin = None
    return spans
