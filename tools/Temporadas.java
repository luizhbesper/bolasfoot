import java.lang.reflect.*;
import java.util.*;

// Fase 2 (gate): roda N temporadas do Brasfoot original só com IA e imprime uma linha JSON por temporada, para comparar
// com `pnpm sim --temporadas`. Mundo como o Calendario/Oracle (best.p.dd()/dg()), ano-base 2026, sem continentais e
// seleções (o port ainda não as tem). Sem humanos (f_0.bs = false), cada f_0.ap() joga um dia; no fim (bk) vira o ano
// (V() → aa()) e mede. Uso: tools/temporadas.sh [N=10]
public class Temporadas {
  public static void main(String[] a) throws Exception {
    int n = a.length > 0 ? Integer.parseInt(a[0]) : 10;
    Class.forName("best.h2").getMethod("main", String[].class).invoke(null, (Object) new String[0]);
    Class.forName("c.a").getConstructor().newInstance();
    Object sr = Class.forName("c.a").getField("SR").get(null);
    Class<?> loader = Class.forName("best.p");
    loader.getMethod("dd").invoke(null);
    call(sr, "I", 2026);
    call(sr, "setJogaIntClubes", false);
    call(sr, "setJogaSelecoesAll", false);
    for (Object o : (List<?>) get(sr, "bF")) if ((int) call(o, "getPais") == 29) call(o, "v", true); // joga a liga BR
    loader.getMethod("dg").invoke(null);
    set(sr, "bs", false);
    for (int t = 1; t <= n; t++) {
      int dias = 0;
      while (!(boolean) get(sr, "bk")) {
        call(sr, "ap");
        if (++dias > 400) throw new IllegalStateException("temporada sem fim");
      }
      call(sr, "V"); // bk → aa(): fim de temporada (e o 1º dia da seguinte)
      System.out.println(medir(sr, t, dias)); // depois da virada, como o resumoTemporada do port
    }
    System.exit(0);
  }

  static String medir(Object sr, int t, int dias) throws Exception {
    double[] soma = new double[4];
    int[] nTimes = new int[4];
    int pros = 0, juniores = 0, estrelas = 0, max = 0;
    double idade = 0;
    for (Object time : (List<?>) call(sr, "P")) {
      int div = (int) call(time, "getDivisao");
      int k = (int) call(time, "getPais") == 29 && div >= 1 && div <= 3 ? div - 1 : 3;
      List<Integer> f = new ArrayList<>();
      for (Object j : (List<?>) call(time, "kc")) {
        int x = (int) call(j, "fi");
        f.add(x);
        pros++;
        idade += (int) call(j, "getIdade");
        if ((Boolean) call(j, "ff")) estrelas++;
        max = Math.max(max, x);
      }
      juniores += (int) call(time, "kx");
      f.sort(Collections.reverseOrder());
      double s = 0;
      int m = Math.min(11, f.size());
      for (int i = 0; i < m; i++) s += f.get(i);
      if (m > 0) {
        soma[k] += s / m;
        nTimes[k]++;
      }
    }
    StringBuilder o = new StringBuilder("{\"temporada\":" + t + ",\"dias\":" + dias + ",\"forcaTop11\":[");
    for (int k = 0; k < 4; k++) o.append(k > 0 ? "," : "").append(String.format(Locale.ROOT, "%.1f", soma[k] / nTimes[k]));
    o.append("],\"times\":[").append(nTimes[0]).append(',').append(nTimes[1]).append(',').append(nTimes[2]).append(',').append(nTimes[3]).append(']');
    o.append(",\"ativos\":").append(pros).append(",\"juniores\":").append(juniores).append(",\"estrelas\":").append(estrelas);
    o.append(",\"forcaMax\":").append(max).append(String.format(Locale.ROOT, ",\"idadeMedia\":%.2f}", idade / pros));
    return o.toString();
  }

  static Object call(Object o, String nome, Object... args) throws Exception {
    for (Class<?> c = o.getClass(); c != null; c = c.getSuperclass())
      for (Method m : c.getDeclaredMethods())
        if (m.getName().equals(nome) && m.getParameterCount() == args.length) {
          m.setAccessible(true);
          return m.invoke(o, args);
        }
    throw new NoSuchMethodException(nome);
  }

  static Object get(Object o, String campo) throws Exception {
    Field f = o.getClass().getDeclaredField(campo);
    f.setAccessible(true);
    return f.get(o);
  }

  static void set(Object o, String campo, Object v) throws Exception {
    Field f = o.getClass().getDeclaredField(campo);
    f.setAccessible(true);
    f.set(o, v);
  }
}
