import java.lang.reflect.*;
import java.util.*;

// M6: oráculo estatístico. Roda o motor de partida do Brasfoot original no mesmo processo
// e imprime uma linha JSON por partida (mesmo formato do ResumoJogo de packages/engine/src/estatisticas.ts).
// Uso: tools/oracle.sh [N] [seed]. Bit a bit é impossível (o original usa new Random() sem seed); compara-se a distribuição.
//
// Protocolo (igual ao simularLote do port): mundo novo de 2022 com só a liga BR, pares sorteados da Série A,
// competição tipo 1, temporada 1, energia 100, força original e sem lesão/cartão antes de cada jogo, escalação e tática da IA,
// I.V() (caminho só-IA: acréscimos, cartões, lesões, subs).
public class Oracle {
  public static void main(String[] a) throws Exception {
    int n = a.length > 0 ? Integer.parseInt(a[0]) : 10000;
    Random pares = new Random(a.length > 1 ? Long.parseLong(a[1]) : 1L);

    // sobe o jogo como no RefShots (idioma, look-and-feel, tela inicial) e faz o que o botão "Novo jogo"
    // faz (a/gq.java:91-93): cria c.a.SR e carrega os times
    Class.forName("best.h2").getMethod("main", String[].class).invoke(null, (Object) new String[0]);
    Class.forName("c.a").getConstructor().newInstance();
    Object sr = Class.forName("c.a").getField("SR").get(null);
    Class<?> loader = Class.forName("best.p");
    loader.getMethod("dd").invoke(null);

    // configuração do novo jogo (a/hU.java:196-213 sem a UI): 2022, só a liga BR, sem estaduais/continentais/seleções
    call(sr, "I", 2022);
    call(sr, "setJogaEstadual", false);
    call(sr, "setJogaIntClubes", false);
    call(sr, "setJogaSelecoesAll", false);
    for (Object o : (List<?>) get(sr, "bF")) if ((int) call(o, "getPais") == 29) call(o, "v", true);
    loader.getMethod("dg").invoke(null);

    List<Object> serieA = new ArrayList<>();
    for (Object t : (List<?>) call(sr, "P")) if ((int) call(t, "getPais") == 29 && (int) call(t, "getDivisao") == 1) serieA.add(t);
    if (serieA.size() != 20) throw new IllegalStateException("Série A com " + serieA.size() + " times");
    System.err.println("mundo criado; Série A ok; simulando " + n + " partidas");

    Object liga = Class.forName("f.B").getConstructor().newInstance();
    call(liga, "F", 1, 1); // tipo 1 (liga nacional), divisão 1
    Class<?> I = Class.forName("best.I"), ah = Class.forName("best.ah");
    Field fx = I.getDeclaredField("fx");
    fx.setAccessible(true);
    Method hb = I.getDeclaredMethod("hb");
    hb.setAccessible(true);
    Method escalar = ah.getMethod("a", ah, I, int.class, int.class, boolean.class);
    Field eI = Class.forName("best.F").getDeclaredField("eI");
    eI.setAccessible(true);

    StringBuilder out = new StringBuilder();
    for (int i = 0; i < n; i++) {
      int x = pares.nextInt(20), y = (x + 1 + pares.nextInt(19)) % 20;
      Object m = serieA.get(x), v = serieA.get(y);
      Map<Object, Integer> forca = new HashMap<>();
      for (Object t : new Object[] { m, v })
        for (Object f : (List<?>) call(t, "kc")) {
          call(f, "ai", 100); // energia
          call(f, "aw", 0); // amarelos na partida
          eI.setLong(f, 0L); // lesão
          forca.put(f, (Integer) call(f, "fi"));
        }
      Object jogo = I.getConstructor(ah, ah, boolean.class).newInstance(m, v, false);
      fx.set(jogo, liga);
      hb.invoke(jogo); // minutos das substituições (o construtor de debug não sorteia)
      escalar.invoke(null, m, jogo, 1, -1, true);
      escalar.invoke(null, v, jogo, 2, -1, true);
      call(jogo, "V");
      for (Map.Entry<Object, Integer> e : forca.entrySet()) call(e.getKey(), "ad", e.getValue()); // lesão ≥35 anos tira 5 de força para sempre (F.java:2127)

      int[] chutes = (int[]) call(jogo, "hA"), alvo = (int[]) call(jogo, "hZ");
      int[] posse = (int[]) call(jogo, "hY"), desarmes = (int[]) call(jogo, "hB"), passes = (int[]) call(jogo, "hC");
      out.setLength(0);
      out.append("{\"p\":[").append(call(jogo, "hu")).append(',').append(call(jogo, "hw"))
         .append("],\"c\":[").append(chutes[0]).append(',').append(chutes[1])
         .append("],\"a\":[").append(alvo[0]).append(',').append(alvo[1])
         .append("],\"x\":[").append(posse[0]).append(',').append(posse[1]).append(',').append(desarmes[0]).append(',').append(desarmes[1]).append(',').append(passes[0]).append(',').append(passes[1])
         .append("],\"e\":[");
      boolean primeiro = true;
      for (Object e : (List<?>) call(jogo, "hE")) {
        if (!primeiro) out.append(',');
        primeiro = false;
        out.append('[').append(call(e, "b")).append(',').append((int) call(e, "b") == 1 ? call(e, "el") : 0)
           .append(',').append(call(e, "en")).append(',').append(call(e, "em")).append(',').append(call(e, "et")).append(']');
      }
      System.out.println(out.append("]}"));
    }
    System.out.flush();
    System.exit(0);
  }

  static Object get(Object o, String campo) throws Exception {
    return o.getClass().getField(campo).get(o);
  }

  // chama o método público pelo nome e nº de argumentos (desembrulhando int/boolean)
  static Object call(Object o, String nome, Object... args) throws Exception {
    for (Method m : o.getClass().getMethods()) {
      if (!m.getName().equals(nome) || m.getParameterCount() != args.length) continue;
      Class<?>[] p = m.getParameterTypes();
      boolean ok = true;
      for (int i = 0; i < p.length && ok; i++)
        ok = args[i] == null || (p[i] == int.class && args[i] instanceof Integer) || (p[i] == boolean.class && args[i] instanceof Boolean) || p[i].isInstance(args[i]);
      if (ok) return m.invoke(o, args);
    }
    throw new NoSuchMethodException(o.getClass().getName() + "." + nome + "/" + args.length);
  }
}
