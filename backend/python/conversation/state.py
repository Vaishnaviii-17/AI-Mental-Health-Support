from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any


@dataclass
class ConversationState:

    # =========================================================
    # CONVERSATION HISTORY
    # =========================================================

    history: List[Dict[str, Any]] = field(default_factory=list)

    # =========================================================
    # CURRENT TOPIC
    # =========================================================

    current_topic: Optional[str] = None
    previous_topic: Optional[str] = None

    # =========================================================
    # CURRENT EMOTION
    # =========================================================

    current_emotion: Optional[str] = None
    previous_emotion: Optional[str] = None

    # =========================================================
    # MODEL SCORES
    # =========================================================

    topic_scores: Dict[str, float] = field(default_factory=dict)
    emotion_scores: Dict[str, float] = field(default_factory=dict)

    # =========================================================
    # CONVERSATION INFORMATION
    # =========================================================

    turn_count: int = 0

    # =========================================================
    # CONVERSATIONAL STRATEGY
    #
    # Examples:
    #   reflect_and_explore
    #   reflect_and_follow
    #   clarify
    #   validate_and_explore
    #   summarize_and_explore
    #   supportive_response
    # =========================================================

    current_strategy: Optional[str] = None
    previous_strategy: Optional[str] = None

    # Why the current strategy was selected
    strategy_reason: Optional[str] = None

    # =========================================================
    # THERAPEUTIC CONVERSATION CONTEXT
    # =========================================================

    # What the user appears to be discussing
    conversation_focus: Optional[str] = None

    # Most recent assistant question
    last_assistant_question: Optional[str] = None

    # Whether the assistant asked a question in the previous turn
    awaiting_user_response: bool = False

    # =========================================================
    # QUESTIONNAIRE STATE
    # =========================================================

    # Whether the conversation has entered questionnaire mode
    questionnaire_active: bool = False

    # Current questionnaire question
    current_question: Optional[str] = None

    # Number of questionnaire questions asked
    questionnaire_turn: int = 0

    # Maximum questionnaire questions before returning
    # to normal conversational flow
    questionnaire_max_turns: int = 5

    # Questions already asked during this conversation
    asked_questions: List[str] = field(default_factory=list)

    # =========================================================
    # CONVERSATIONAL MEMORY
    # =========================================================

    # Important facts extracted from the conversation.
    #
    # Example:
    # {
    #     "exam": "upcoming exams",
    #     "family_pressure": "parents compare user with cousin"
    # }
    #
    # This is intentionally generic. Later the LLM can populate it.
    memory: Dict[str, Any] = field(default_factory=dict)

    # =========================================================
    # RISK INFORMATION
    # =========================================================

    current_risk_level: Optional[str] = None
    current_risk_score: Optional[float] = None
    risk_categories: List[str] = field(default_factory=list)

    # =========================================================
    # ADD A CONVERSATION TURN
    # =========================================================

    def add_turn(
        self,
        user_text: str,
        topic: Optional[str] = None,
        topic_scores: Optional[Dict[str, float]] = None,
        emotion: Optional[str] = None,
        emotion_scores: Optional[Dict[str, float]] = None,
        strategy: Optional[str] = None,
        strategy_reason: Optional[str] = None,
        risk_level: Optional[str] = None,
        risk_score: Optional[float] = None,
        risk_categories: Optional[List[str]] = None,
    ):

        # -----------------------------------------------------
        # Save previous state
        # -----------------------------------------------------

        self.previous_topic = self.current_topic
        self.previous_emotion = self.current_emotion
        self.previous_strategy = self.current_strategy

        # -----------------------------------------------------
        # Update current state
        # -----------------------------------------------------

        self.current_topic = topic
        self.current_emotion = emotion

        self.topic_scores = topic_scores or {}
        self.emotion_scores = emotion_scores or {}

        self.current_strategy = strategy
        self.strategy_reason = strategy_reason

        # -----------------------------------------------------
        # Risk information
        # -----------------------------------------------------

        self.current_risk_level = risk_level
        self.current_risk_score = risk_score

        self.risk_categories = risk_categories or []

        # -----------------------------------------------------
        # Increment turn
        # -----------------------------------------------------

        self.turn_count += 1

        # -----------------------------------------------------
        # Store user message
        # -----------------------------------------------------

        self.history.append({
            "turn": self.turn_count,
            "role": "user",
            "user": user_text,
            "topic": topic,
            "emotion": emotion,
            "strategy": strategy,
            "strategy_reason": strategy_reason,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_categories": risk_categories or []
        })

        # -----------------------------------------------------
        # If user responds, we are no longer waiting for
        # a response to the previous assistant question.
        # -----------------------------------------------------

        self.awaiting_user_response = False

    # =========================================================
    # ADD ASSISTANT RESPONSE
    # =========================================================

    def add_assistant_turn(
        self,
        response: str,
        question: Optional[str] = None
    ):
        """
        Store the assistant's response.

        If the response contains a question, store it separately
        so that the next user message can be interpreted in the
        context of that question.
        """

        self.history.append({
            "turn": self.turn_count,
            "role": "assistant",
            "assistant": response,
            "question": question
        })

        if question:
            self.last_assistant_question = question
            self.current_question = question
            self.awaiting_user_response = True

            if question not in self.asked_questions:
                self.asked_questions.append(question)

    # =========================================================
    # GET MOST RECENT USER MESSAGE
    # =========================================================

    def get_last_message(self) -> Optional[str]:

        for item in reversed(self.history):

            if item.get("role") == "user":
                return item.get("user")

        return None

    # =========================================================
    # GET LAST ASSISTANT RESPONSE
    # =========================================================

    def get_last_assistant_response(self) -> Optional[str]:

        for item in reversed(self.history):

            if item.get("role") == "assistant":
                return item.get("assistant")

        return None

    # =========================================================
    # GET RECENT CONVERSATION HISTORY
    # =========================================================

    def get_recent_history(self, limit: int = 5):

        return self.history[-limit:]

    # =========================================================
    # GET RECENT USER MESSAGES ONLY
    # =========================================================

    def get_recent_user_messages(self, limit: int = 5):

        messages = [
            item["user"]
            for item in self.history
            if item.get("role") == "user"
        ]

        return messages[-limit:]

    # =========================================================
    # CHECK WHETHER TOPIC CHANGED
    # =========================================================

    def topic_changed(self) -> bool:

        if self.previous_topic is None:
            return False

        if self.current_topic is None:
            return False

        return self.previous_topic != self.current_topic

    # =========================================================
    # CHECK WHETHER EMOTION CHANGED
    # =========================================================

    def emotion_changed(self) -> bool:

        if self.previous_emotion is None:
            return False

        if self.current_emotion is None:
            return False

        return self.previous_emotion != self.current_emotion

    # =========================================================
    # CHECK WHETHER CONVERSATION IS ON SAME TOPIC
    # =========================================================

    def topic_continued(self) -> bool:

        if self.previous_topic is None:
            return False

        if self.current_topic is None:
            return False

        return self.previous_topic == self.current_topic

    # =========================================================
    # CHECK WHETHER EMOTION IS CONTINUING
    # =========================================================

    def emotion_continued(self) -> bool:

        if self.previous_emotion is None:
            return False

        if self.current_emotion is None:
            return False

        return self.previous_emotion == self.current_emotion

    # =========================================================
    # START QUESTIONNAIRE MODE
    # =========================================================

    def start_questionnaire(self):

        self.questionnaire_active = True
        self.questionnaire_turn = 0

    # =========================================================
    # ADD QUESTIONNAIRE QUESTION
    # =========================================================

    def add_questionnaire_question(self, question: str):

        self.questionnaire_active = True

        self.questionnaire_turn += 1

        self.current_question = question
        self.last_assistant_question = question
        self.awaiting_user_response = True

        if question not in self.asked_questions:
            self.asked_questions.append(question)

    # =========================================================
    # CHECK WHETHER QUESTIONNAIRE SHOULD CONTINUE
    # =========================================================

    def questionnaire_should_continue(self) -> bool:

        if not self.questionnaire_active:
            return False

        return self.questionnaire_turn < self.questionnaire_max_turns

    # =========================================================
    # END QUESTIONNAIRE MODE
    # =========================================================

    def end_questionnaire(self):

        self.questionnaire_active = False
        self.questionnaire_turn = 0
        self.current_question = None

    # =========================================================
    # SAVE MEMORY
    # =========================================================

    def save_memory(
        self,
        key: str,
        value: Any
    ):

        self.memory[key] = value

    # =========================================================
    # GET MEMORY
    # =========================================================

    def get_memory(
        self,
        key: str,
        default: Any = None
    ):

        return self.memory.get(key, default)

    # =========================================================
    # UPDATE CONVERSATION FOCUS
    # =========================================================

    def set_focus(self, focus: Optional[str]):

        self.conversation_focus = focus

    # =========================================================
    # SET STRATEGY
    # =========================================================

    def set_strategy(
        self,
        strategy: str,
        reason: Optional[str] = None
    ):

        self.previous_strategy = self.current_strategy

        self.current_strategy = strategy

        self.strategy_reason = reason

    # =========================================================
    # GET STATE SUMMARY
    # =========================================================

    def get_summary(self):

        return {
            "turn_count": self.turn_count,

            "current_topic": self.current_topic,
            "previous_topic": self.previous_topic,

            "current_emotion": self.current_emotion,
            "previous_emotion": self.previous_emotion,

            "current_strategy": self.current_strategy,
            "strategy_reason": self.strategy_reason,

            "conversation_focus": self.conversation_focus,

            "questionnaire_active": self.questionnaire_active,
            "questionnaire_turn": self.questionnaire_turn,

            "awaiting_user_response": self.awaiting_user_response,

            "current_risk_level": self.current_risk_level,
            "current_risk_score": self.current_risk_score,

            "memory": self.memory
        }

    # =========================================================
    # CONVERT STATE TO DICTIONARY
    # =========================================================

    def to_dict(self):

        return {
            "history": self.history,

            "current_topic": self.current_topic,
            "previous_topic": self.previous_topic,

            "current_emotion": self.current_emotion,
            "previous_emotion": self.previous_emotion,

            "topic_scores": self.topic_scores,
            "emotion_scores": self.emotion_scores,

            "turn_count": self.turn_count,

            "current_strategy": self.current_strategy,
            "previous_strategy": self.previous_strategy,
            "strategy_reason": self.strategy_reason,

            "conversation_focus": self.conversation_focus,

            "last_assistant_question": self.last_assistant_question,
            "awaiting_user_response": self.awaiting_user_response,

            "questionnaire_active": self.questionnaire_active,
            "current_question": self.current_question,
            "questionnaire_turn": self.questionnaire_turn,
            "questionnaire_max_turns": self.questionnaire_max_turns,
            "asked_questions": self.asked_questions,

            "memory": self.memory,

            "current_risk_level": self.current_risk_level,
            "current_risk_score": self.current_risk_score,
            "risk_categories": self.risk_categories
        }