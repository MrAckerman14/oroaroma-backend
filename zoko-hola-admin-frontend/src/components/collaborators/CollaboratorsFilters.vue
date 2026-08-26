<template>
  <DateRangeFilter
    :from="from"
    :to="to"
    @update:from="$emit('update:from', $event)"
    @update:to="$emit('update:to', $event)"
    @filter="$emit('filter')"
  />
</template>

<script>
import DateRangeFilter from "components/common/DateRangeFilter.vue";

export default {
  name: "CollaboratorsFilters",
  components: { DateRangeFilter },
  props: {
    from: { type: String, default: "" },
    to: { type: String, default: "" },
  },
  emits: ["update:from", "update:to", "filter"],
};
</script>
