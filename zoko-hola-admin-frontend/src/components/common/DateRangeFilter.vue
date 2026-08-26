<template>
  <q-input
    class="date-range-filter"
    :model-value="rangeLabel"
    label="Rango de fechas"
    outlined
    dense
    readonly
    color="black"
    @click="$refs.datePopup.show()"
  >
    <template #append>
      <q-icon name="event" class="cursor-pointer">
        <q-popup-proxy
          ref="datePopup"
          cover
          transition-show="scale"
          transition-hide="scale"
        >
          <q-date
            v-model="dateRange"
            range
            mask="YYYY/MM/DD"
            color="yellow-9"
            text-color="black"
            @range-end="selectRange"
          />
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script>
export default {
  name: "DateRangeFilter",

  props: {
    from: { type: String, default: "" },
    to: { type: String, default: "" },
  },

  emits: ["update:from", "update:to", "range-selected", "filter"],

  data() {
    return {
      dateRange: this.rangeFromProps(),
    };
  },

  computed: {
    rangeLabel() {
      if (!this.from || !this.to) return "Selecciona un rango";

      return `${this.displayDate(this.from)} - ${this.displayDate(this.to)}`;
    },
  },

  watch: {
    from() {
      this.dateRange = this.rangeFromProps();
    },

    to() {
      this.dateRange = this.rangeFromProps();
    },
  },

  methods: {
    rangeFromProps() {
      return {
        from: this.toQDate(this.from),
        to: this.toQDate(this.to),
      };
    },

    toQDate(value) {
      return String(value || "").replaceAll("-", "/");
    },

    toApiDate(value) {
      return String(value || "").replaceAll("/", "-");
    },

    rangeDateToMask(value) {
      if (typeof value === "string") return value;
      if (!value || !value.year || !value.month || !value.day) return "";

      return [value.year, value.month, value.day]
        .map((part) => String(part).padStart(2, "0"))
        .join("/");
    },

    displayDate(value) {
      const [year, month, day] = String(value).split("-");
      return year && month && day ? `${day}/${month}/${year}` : value;
    },

    selectRange(value) {
      const from = this.rangeDateToMask(value?.from);
      const to = this.rangeDateToMask(value?.to);
      if (!from || !to) return;

      this.dateRange = { from, to };

      const range = {
        from: this.toApiDate(from),
        to: this.toApiDate(to),
      };

      this.$emit("update:from", range.from);
      this.$emit("update:to", range.to);
      this.$emit("range-selected", range);

      this.$nextTick(() => {
        this.$emit("filter");
        this.$refs.datePopup?.hide();
      });
    },
  },
};
</script>

<style scoped>
.date-range-filter {
  min-width: 235px;
}

@media (max-width: 599px) {
  .date-range-filter {
    width: 100%;
    min-width: 0;
  }
}
</style>
