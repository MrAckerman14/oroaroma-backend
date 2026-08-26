<template>
  <div class="login-page flex flex-center q-pa-md">
    <main class="login-frame">
      <section class="login-panel">
        <div class="login-panel__inner">
          <header class="login-form-header">
            <q-avatar size="64px" class="login-form-header__logo">
              <img :src="appTheme.logo" :alt="appTheme.name" />
            </q-avatar>
            <div class="login-form-header__eyebrow">{{ appTheme.name }}</div>
            <h1>Bienvenido de vuelta</h1>
            <p>Inicia sesión para acceder al panel de administración.</p>
          </header>

          <q-form class="login-form q-mt-xl" @submit.prevent="login">
          <q-input
            v-model="email"
            outlined
            color="primary"
            label="Correo electrónico"
            type="email"
            autocomplete="email"
            lazy-rules
            :rules="[(val) => !!val || 'Ingresa tu correo']"
          >
            <template #prepend><q-icon name="mail_outline" /></template>
          </q-input>

          <q-input
            v-model="password"
            class="q-mt-md"
            outlined
            color="primary"
            label="Contraseña"
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="current-password"
            lazy-rules
            :rules="[(val) => !!val || 'Ingresa tu contraseña']"
          >
            <template #prepend><q-icon name="lock_outline" /></template>
            <template #append>
              <q-btn
                flat
                round
                dense
                color="grey-7"
                :icon="passwordVisible ? 'visibility_off' : 'visibility'"
                :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="passwordVisible = !passwordVisible"
              />
            </template>
          </q-input>

          <q-btn
            class="login-form__submit full-width q-mt-lg"
            label="Iniciar sesión"
            icon="login"
            type="submit"
            unelevated
            no-caps
            :loading="loading"
            :disable="loading"
          />
          </q-form>
        </div>
      </section>

      <aside class="login-showcase">
        <div class="login-showcase__content">
          <q-avatar size="112px" class="login-showcase__logo">
            <img :src="appTheme.logo" :alt="appTheme.name" />
          </q-avatar>
          <div class="login-showcase__eyebrow">¡HOLA!</div>
          <h2>{{ appTheme.name }} Admin</h2>
          <p>Una forma simple de mantener tu operación organizada cada día.</p>
          <div class="login-showcase__features">
            <div><q-icon name="point_of_sale" /> Ventas y cierres de caja</div>
            <div><q-icon name="inventory_2" /> Inventario actualizado</div>
            <div><q-icon name="groups" /> Gestión de tu equipo</div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script>
import { Cookies, Notify } from "quasar";
import { api } from "boot/axios";
import { apiErrorMessage } from "src/services/apiAdapters";
import { roleFromUser, useAuthStore } from "src/stores/auth";
import { appTheme } from "src/config/appTheme";

export default {
  name: "LoginView",

  data() {
    return {
      email: "",
      password: "",
      passwordVisible: false,
      loading: false,
      appTheme,
      auth: null,
    };
  },

  created() {
    this.auth = useAuthStore();
  },

  methods: {
    async login() {
      if (this.loading) return;
      this.loading = true;

      try {
        this.auth.clearSession();

        const response = await api.post("/auth/login", {
          email: this.email,
          password: this.password,
        });

        const session = response.data?.data || response.data;
        const user = session.user;
        const role = roleFromUser(user);
        const roleKey =
          user?.roles?.[0]?.roleKey || user?.roles?.[0]?.key || user?.roleKey;

        Cookies.set("token", session.accessToken || session.token, {
          expires: 7,
        });

        if (session.refreshToken) {
          Cookies.set("refresh_token", session.refreshToken, {
            expires: 30,
          });
        }

        this.auth.setSession(user.name, role, user.id, roleKey);
        await this.$router.replace("/");
      } catch (err) {
        Notify.create({
          type: "negative",
          message: apiErrorMessage(err, "Datos incorrectos"),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 80% 10%, rgba(40, 101, 178, .12), transparent 28rem),
    var(--app-page);
}

.login-frame {
  display: grid;
  grid-template-columns: minmax(380px, 1fr) minmax(330px, .86fr);
  width: min(100%, 940px);
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 26px;
  box-shadow: 0 20px 52px rgba(7, 31, 71, .15);
  background: var(--app-surface);
}

.login-panel {
  display: flex;
  align-items: center;
  min-height: 550px;
  padding: 54px 64px;
}

.login-panel__inner {
  width: 100%;
}

.login-form-header__logo {
  box-sizing: border-box;
  overflow: hidden;
  border: 2px solid var(--app-primary-border);
  border-radius: 50%;
  background: var(--app-surface);
}

.login-form-header__eyebrow {
  margin-top: 18px;
  color: var(--app-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.login-form-header h1 {
  margin: 8px 0;
  color: var(--app-ink);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.2;
}

.login-form-header p {
  margin: 0;
  color: var(--app-muted);
  font-size: 14px;
  line-height: 1.55;
}

.login-showcase {
  display: flex;
  align-items: center;
  padding: 54px;
  color: var(--app-surface);
  background:
    linear-gradient(145deg, rgba(185, 212, 255, .14), transparent 54%),
    var(--app-ink-soft);
}

.login-showcase__content {
  max-width: 290px;
}

.login-showcase__logo {
  box-sizing: border-box;
  overflow: hidden;
  border: 3px solid var(--app-menu-user-icon);
  border-radius: 50%;
  background: var(--app-surface);
}

.login-form-header__logo :deep(img),
.login-showcase__logo :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.login-showcase__eyebrow {
  margin-top: 26px;
  color: var(--app-menu-user-icon);
  font-size: 14px;
  font-weight: 700;
}

.login-showcase h2 {
  margin: 6px 0 10px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.2;
}

.login-showcase p {
  margin: 0;
  color: rgba(255, 255, 255, .76);
  font-size: 14px;
  line-height: 1.6;
}

.login-showcase__features {
  display: grid;
  gap: 14px;
  margin-top: 30px;
  color: rgba(255, 255, 255, .92);
  font-size: 13px;
  font-weight: 600;
}

.login-showcase__features .q-icon {
  margin-right: 8px;
  color: var(--app-menu-user-icon);
}

.login-form :deep(.q-field__control) {
  min-height: 54px;
  border-radius: 12px;
}

.login-form :deep(.q-field--outlined .q-field__control:before) {
  border-color: var(--app-border);
}

.login-form__submit {
  min-height: 50px;
  border-radius: 10px;
  color: var(--app-surface) !important;
  background: var(--app-primary) !important;
  font-weight: 700;
  letter-spacing: .01em;
}

@media (max-width: 599px) {
  .login-page {
    padding: 20px 16px;
  }

  .login-frame {
    grid-template-columns: 1fr;
    border-radius: 22px;
  }

  .login-panel {
    min-height: auto;
    padding: 34px 28px;
  }

  .login-showcase {
    min-height: auto;
    padding: 20px 28px 22px;
  }

  .login-showcase__logo {
    display: none;
  }

  .login-showcase__eyebrow {
    margin-top: 0;
    font-size: 12px;
  }

  .login-showcase h2 {
    margin: 4px 0 0;
    font-size: 21px;
  }

  .login-showcase p,
  .login-showcase__features {
    display: none;
  }
}
</style>
