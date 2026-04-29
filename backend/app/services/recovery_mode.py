from dataclasses import dataclass

@dataclass
class RecoveryStatus:
    enabled: bool
    mode: str
    message: str

class RecoveryMode:
    def evaluate(self, error_rate: float = 0.0, model_latency_ms: int = 0, payments_ok: bool = True) -> RecoveryStatus:
        if not payments_ok:
            return RecoveryStatus(True, "payments_safe_mode", "Payments are protected while checkout is reviewed.")
        if error_rate > 0.03:
            return RecoveryStatus(True, "safe_mode", "SONARA is reducing non-critical features to protect the session.")
        if model_latency_ms > 8000:
            return RecoveryStatus(True, "ai_degraded", "AI is using faster fallback responses.")
        return RecoveryStatus(False, "normal", "All core systems are operating normally.")
