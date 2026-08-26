<template>
  <div class="error-page flex flex-center q-pa-md">
    <q-card flat class="error-card bg-white">
      <q-card-section class="q-pa-lg q-pa-sm-xl text-center">
        <div class="row items-center justify-center q-gutter-sm q-mb-xl">
          <q-avatar size="42px" class="error-brand-logo">
            <img :src="appTheme.logo" :alt="appTheme.name" />
          </q-avatar>
          <span class="text-subtitle1 text-weight-bold">{{ appTheme.name }}</span>
        </div>

        <q-avatar size="76px" color="yellow-9" text-color="dark" icon="explore_off" class="q-mb-md" />
        <div class="error-code text-weight-bolder">404</div>
        <div class="text-h5 text-weight-bold q-mt-sm">Esta página no está disponible</div>
        <p class="text-body1 text-grey-7 q-mx-auto q-mt-md q-mb-xl error-description">
          La dirección puede estar incompleta, haber cambiado o no estar disponible para tu cuenta.
        </p>

        <div class="row justify-center q-gutter-sm">
          <q-btn
            outline
            color="grey-9"
            icon="arrow_back"
            label="Volver"
            no-caps
            @click="goBack"
          />
          <q-btn
            unelevated
            color="yellow-9"
            text-color="dark"
            icon="point_of_sale"
            label="Ir a ventas"
            no-caps
            to="/"
          />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { appTheme } from "src/config/appTheme";

const router = useRouter();

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push("/");
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  background-color: var(--app-ink);
  background-image: linear-gradient(rgba(249, 168, 37, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(249, 168, 37, 0.06) 1px, transparent 1px);
  background-size: 42px 42px;
}

.error-card {
  width: min(560px, 100%);
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.1);
}

.error-brand-logo {
  border: 1px solid #f2e0ad;
}

.error-code {
  color: var(--app-primary);
  font-size: clamp(5rem, 20vw, 9rem);
  line-height: 0.88;
  letter-spacing: -0.08em;
}

.error-description {
  max-width: 410px;
}

@media (max-width: 599px) {
  .error-card {
    border-radius: 20px;
  }
}
</style>
