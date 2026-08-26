from services.semantic_service import SemanticService
from services.emotion_service import EmotionService
from services.response_generator import ResponseGenerator
from conversation.state import ConversationState


class ConversationAnalyzer:

    def __init__(self):

        print("Initializing Conversation Analyzer...")

        # -----------------------------------------------------
        # Services
        # -----------------------------------------------------

        self.semantic_service = SemanticService()
        self.emotion_service = EmotionService()
        self.response_generator = ResponseGenerator()

        print("Conversation Analyzer ready.")

    # =========================================================
    # STRATEGY SELECTION
    # =========================================================

    def _determine_strategy(
        self,
        state,
        previous_topic,
        previous_emotion
    ):
        """
        Decide how the response should continue based on
        conversation state.

        Priority:

        1. First turn
        2. Topic changed
        3. Emotion changed
        4. Continue current conversation
        """

        # -----------------------------------------------------
        # First turn
        # -----------------------------------------------------

        if state.turn_count == 1:

            return (
                "reflect_and_explore",
                "first_turn"
            )

        # -----------------------------------------------------
        # Topic changed
        # -----------------------------------------------------

        if (
            previous_topic is not None
            and previous_topic != state.current_topic
        ):

            return (
                "reflect_and_follow",
                "topic_changed"
            )

        # -----------------------------------------------------
        # Emotion changed
        # -----------------------------------------------------

        if (
            previous_emotion is not None
            and previous_emotion != state.current_emotion
        ):

            return (
                "reflect_and_explore",
                "emotion_changed"
            )

        # -----------------------------------------------------
        # Continue current topic/emotion
        # -----------------------------------------------------

        return (
            "reflect_and_follow",
            "continue"
        )

    # =========================================================
    # PROCESS ONE USER MESSAGE
    # =========================================================

    def process(self, text, state=None):

        if not isinstance(text, str):
            raise ValueError("text must be a string")

        text = text.strip()

        if not text:
            raise ValueError("text cannot be empty")

        # -----------------------------------------------------
        # Create state if this is a new conversation
        # -----------------------------------------------------

        if state is None:
            state = ConversationState()

        # =====================================================
        # 1. SEMANTIC ANALYSIS
        # =====================================================

        semantic_result = self.semantic_service.detect_context(text)

        # =====================================================
        # 2. EMOTION ANALYSIS
        # =====================================================

        emotion_result = self.emotion_service.analyze(text)

        # =====================================================
        # 3. SAVE PREVIOUS STATE
        # =====================================================

        previous_topic = state.current_topic
        previous_emotion = state.current_emotion

        # =====================================================
        # 4. UPDATE CONVERSATION STATE
        # =====================================================

        state.add_turn(
            user_text=text,

            topic=semantic_result.get("topic"),

            topic_scores=semantic_result.get(
                "topic_scores",
                {}
            ),

            emotion=emotion_result.get("emotion"),

            emotion_scores=emotion_result.get(
                "emotion_scores",
                {}
            )
        )

        # =====================================================
        # 5. DETERMINE CHANGES
        # =====================================================

        topic_changed = (
            previous_topic is not None
            and previous_topic != state.current_topic
        )

        emotion_changed = (
            previous_emotion is not None
            and previous_emotion != state.current_emotion
        )

        # =====================================================
        # 6. DETERMINE RESPONSE STRATEGY
        # =====================================================

        strategy, strategy_reason = self._determine_strategy(
            state=state,
            previous_topic=previous_topic,
            previous_emotion=previous_emotion
        )

        # =====================================================
        # 7. BUILD ANALYSIS RESULT
        # =====================================================

        result = {

            # -------------------------------------------------
            # Original message
            # -------------------------------------------------

            "text": text,

            # -------------------------------------------------
            # Semantic information
            # -------------------------------------------------

            "topic": semantic_result.get("topic"),

            "topic_confidence": semantic_result.get(
                "similarity"
            ),

            "topic_classification": semantic_result.get(
                "classification"
            ),

            "topic_margin": semantic_result.get(
                "margin"
            ),

            "matched_example": semantic_result.get(
                "matched_example"
            ),

            "topic_scores": semantic_result.get(
                "topic_scores",
                {}
            ),

            # -------------------------------------------------
            # Topic history
            # -------------------------------------------------

            "previous_topic": previous_topic,

            "topic_changed": topic_changed,

            # -------------------------------------------------
            # Emotion information
            # -------------------------------------------------

            "emotion": state.current_emotion,

            "emotion_probability": emotion_result.get(
                "probability"
            ),

            "emotion_scores": emotion_result.get(
                "emotion_scores",
                {}
            ),

            "previous_emotion": previous_emotion,

            "emotion_changed": emotion_changed,

            # -------------------------------------------------
            # Sentiment
            # -------------------------------------------------

            "sentiment": emotion_result.get(
                "sentiment"
            ),

            # -------------------------------------------------
            # Risk
            # -------------------------------------------------

            "risk": emotion_result.get(
                "risk"
            ),

            # -------------------------------------------------
            # Strategy
            # -------------------------------------------------

            "strategy": strategy,

            "strategy_reason": strategy_reason,

            # -------------------------------------------------
            # Conversation information
            # -------------------------------------------------

            "turn_count": state.turn_count
        }

        # =====================================================
        # 8. GENERATE RESPONSE
        # =====================================================

        response = self.response_generator.generate(
            analysis=result,
            state=state
        )

        # =====================================================
        # 9. SAVE ASSISTANT RESPONSE IN CONVERSATION STATE
        # =====================================================

        state.add_assistant_turn(response)

        # =====================================================
        # 10. ADD RESPONSE TO RESULT
        # =====================================================

        result["response"] = response

        # =====================================================
        # 11. RETURN
        # =====================================================

        return result, state