class ResponseStrategy:

    def decide(self, analysis):

        risk = analysis.get("risk", {})
        risk_level = risk.get("risk_level", "low")

        topic = analysis.get("topic")
        classification = analysis.get(
            "topic_classification"
        )

        emotion = analysis.get("emotion")
        emotion_probability = analysis.get(
            "emotion_probability", 0
        )

        turn_count = analysis.get(
            "turn_count", 1
        )

        topic_changed = analysis.get(
            "topic_changed", False
        )

        emotion_changed = analysis.get(
            "emotion_changed", False
        )

        # =====================================================
        # 1. SAFETY HAS HIGHEST PRIORITY
        # =====================================================

        if risk_level in ["high", "critical"]:
            return {
                "strategy": "safety",
                "reason": "elevated_risk"
            }

        # =====================================================
        # 2. INSUFFICIENT / UNCLEAR CONTEXT
        # =====================================================

        if classification in [
            "out_of_domain",
            "ambiguous"
        ]:
            return {
                "strategy": "clarify",
                "reason": "insufficient_context"
            }

        # =====================================================
        # 3. FIRST TURN
        # =====================================================

        if turn_count == 1:
            return {
                "strategy": "reflect_and_explore",
                "reason": "first_turn"
            }

        # =====================================================
        # 4. USER CHANGED TOPIC
        # =====================================================

        if topic_changed:
            return {
                "strategy": "reflect_and_follow",
                "reason": "topic_changed"
            }

        # =====================================================
        # 5. EMOTION CHANGED
        # =====================================================

        if emotion_changed:
            return {
                "strategy": "reflect_and_explore",
                "reason": "emotion_changed"
            }

        # =====================================================
        # 6. STRONG EMOTION
        # =====================================================

        if emotion_probability >= 0.70:

            return {
                "strategy": "reflect_then_question",
                "reason": "strong_emotion"
            }

        # =====================================================
        # 7. NORMAL CONTINUATION
        # =====================================================

        return {
            "strategy": "explore",
            "reason": "normal_continuation"
        }