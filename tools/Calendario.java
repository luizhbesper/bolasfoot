import java.lang.reflect.*;
import java.util.*;

// W1: gabarito do calendário. Cria o mundo como o Oracle (best.p.dd()/dg()) com o ano-base pedido;
// o dg() chama a.u(), que imprime as datas de cada competição ("Nacional:1) 27/03/2022 Dom 85").
// Uso: tools/calendario.sh [ano=2022]
public class Calendario {
  public static void main(String[] a) throws Exception {
    Class.forName("best.h2").getMethod("main", String[].class).invoke(null, (Object) new String[0]);
    Class.forName("c.a").getConstructor().newInstance();
    Object sr = Class.forName("c.a").getField("SR").get(null);
    Class<?> loader = Class.forName("best.p");
    loader.getMethod("dd").invoke(null);
    Method ano = sr.getClass().getMethod("I", int.class);
    ano.invoke(sr, a.length > 0 ? Integer.parseInt(a[0]) : 2022);
    loader.getMethod("dg").invoke(null);
    System.exit(0);
  }
}
