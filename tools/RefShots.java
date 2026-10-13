import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import javax.imageio.ImageIO;
import javax.swing.*;
import javax.swing.text.JTextComponent;

// F0-6: roda o Brasfoot original no mesmo processo e o pilota por comandos, desenhando as janelas em PNG
// (paint num BufferedImage: não precisa de permissão de Gravação de Tela).
// Uso: tools/capture-ref.sh (roteiro em tools/capture-ref.txt). Comandos, um por linha:
//   tree                     lista a janela do topo (componentes, posição, texto/ícone)
//   click <texto>            clica no botão/label cujo texto, tooltip ou ícone contém <texto> (n-ésimo: click <texto>#2)
//   until <texto>            espera (até 3 min) aparecer botão/label com <texto>
//   shotif <texto>|<nome>    shot só se <texto> estiver na tela (telas aleatórias, ex.: leilão)
//   clickat <x> <y> [2]      clique (ou duplo) no ponto da janela do topo
//   combo <n> <i>            seleciona o item i do n-ésimo JComboBox visível (0-based)
//   row <n> <linha> [2]      clique (ou duplo) na linha do n-ésimo JTable visível (0-based)
//   type <texto>             escreve no campo de texto focado (ou no primeiro vazio)
//   key <ESCAPE|ENTER|...>   tecla na janela do topo
//   wait <ms>                espera
//   shot <nome>              salva <out>/<nome>.png da janela do topo
//   close                    fecha o dialog do topo (no frame principal só fecha popup de menu)
public class RefShots {
  static Path out;

  public static void main(String[] a) throws Exception {
    out = Paths.get(a[0]);
    Files.createDirectories(out);
    BufferedReader in = new BufferedReader(new InputStreamReader(a.length > 1 ? new FileInputStream(a[1]) : System.in, "UTF-8"));
    new Thread(() -> { try { Class.forName("best.h2").getMethod("main", String[].class).invoke(null, (Object) new String[0]); } catch (Throwable t) { t.printStackTrace(); } }).start();
    Thread.sleep(4000);
    for (String line; (line = in.readLine()) != null; ) {
      line = line.trim();
      if (line.isEmpty() || line.startsWith("#")) continue;
      System.out.println("> " + line);
      try { run(line); } catch (Throwable t) { System.out.println("  ERRO: " + t); }
      System.out.flush();
      Thread.sleep(700);
    }
    System.exit(0);
  }

  static void run(String line) throws Exception {
    String[] p = line.split(" ", 2);
    String arg = p.length > 1 ? p[1] : "";
    switch (p[0]) {
      case "tree": edt(() -> { Window w = top(); System.out.println("  [" + w.getClass().getName() + "] " + title(w) + " " + w.getWidth() + "x" + w.getHeight()); tree(w, w, 1); }); break;
      case "click": click(arg); break;
      case "until": until(arg); break;
      case "shotif": { String[] tn = arg.split("\\|"); if (find(tn[0]) != null) shot(tn[1]); else System.out.println("  sem " + tn[0] + ", pulando " + tn[1]); break; }
      case "clickat": { String[] xy = arg.split(" "); clickAt(Integer.parseInt(xy[0]), Integer.parseInt(xy[1]), xy.length > 2 ? Integer.parseInt(xy[2]) : 1); break; }
      case "combo": { String[] ni = arg.split(" "); JComboBox<?> c = (JComboBox<?>) all(JComboBox.class).get(Integer.parseInt(ni[0])); SwingUtilities.invokeLater(() -> c.setSelectedIndex(Integer.parseInt(ni[1]))); break; }
      case "row": {
        String[] ni = arg.split(" ");
        JTable t = all(JTable.class).get(Integer.parseInt(ni[0]));
        int r = Integer.parseInt(ni[1]);
        Point[] pt = new Point[1];
        edt(() -> { t.setRowSelectionInterval(r, r); t.scrollRectToVisible(t.getCellRect(r, 0, true)); Rectangle rc = t.getCellRect(r, 1, true); pt[0] = SwingUtilities.convertPoint(t, rc.x + rc.width / 2, rc.y + rc.height / 2, top()); });
        clickAt(pt[0].x, pt[0].y, ni.length > 2 ? Integer.parseInt(ni[2]) : 1);
        break;
      }
      case "type": edt(() -> { JTextComponent t = textField(top()); if (t != null) t.setText(arg); else System.out.println("  sem campo de texto"); }); break;
      case "key": key(arg); break;
      case "wait": Thread.sleep(Long.parseLong(arg)); break;
      case "shot": shot(arg); break;
      case "close": SwingUtilities.invokeLater(() -> { Window w = top(); if (w instanceof Dialog) w.dispatchEvent(new WindowEvent(w, WindowEvent.WINDOW_CLOSING)); else MenuSelectionManager.defaultManager().clearSelectedPath(); }); break;
      default: System.out.println("  comando desconhecido");
    }
  }

  static void edt(Runnable r) throws Exception { SwingUtilities.invokeAndWait(r); }

  // janela do topo: visível e sem janela filha visível (folha da árvore de donos); empate → ativa, senão a mais nova
  static Window top() {
    Window best = null;
    for (Window w : Window.getWindows()) {
      if (!w.isShowing() || w.getWidth() <= 50) continue;
      boolean leaf = true;
      for (Window o : w.getOwnedWindows()) if (o.isShowing() && o.getWidth() > 50) leaf = false;
      if (!leaf) continue;
      if (w.isActive()) return w;
      best = w;
    }
    return best;
  }

  static String title(Window w) { return w instanceof Frame ? ((Frame) w).getTitle() : w instanceof Dialog ? ((Dialog) w).getTitle() : ""; }

  static String desc(Component c) {
    StringBuilder s = new StringBuilder();
    if (c instanceof AbstractButton) { AbstractButton b = (AbstractButton) c; s.append(" text=").append(q(b.getText())); icon(s, b.getIcon()); }
    if (c instanceof JLabel) { JLabel l = (JLabel) c; s.append(" text=").append(q(l.getText())); icon(s, l.getIcon()); }
    if (c instanceof JTextComponent && !(c instanceof JEditorPane)) s.append(" value=").append(q(((JTextComponent) c).getText()));
    if (c instanceof JComboBox) {
      JComboBox<?> cb = (JComboBox<?>) c;
      s.append(" sel=").append(q(String.valueOf(cb.getSelectedItem()))).append(" n=").append(cb.getItemCount());
      if (cb.getItemCount() <= 16) { s.append(" ["); for (int i = 0; i < cb.getItemCount(); i++) s.append(i).append(':').append(cb.getItemAt(i)).append(i + 1 < cb.getItemCount() ? ", " : ""); s.append(']'); }
    }
    if (c instanceof JTable) s.append(" rows=").append(((JTable) c).getRowCount());
    if (c instanceof JComponent && ((JComponent) c).getToolTipText() != null) s.append(" tip=").append(q(((JComponent) c).getToolTipText()));
    for (MouseListener ml : c.getMouseListeners()) if (!ml.getClass().getName().startsWith("javax.swing") && !ml.getClass().getName().startsWith("sun.") && !ml.getClass().getName().startsWith("java.")) { s.append(" mouse"); break; }
    return s.toString();
  }

  static void icon(StringBuilder s, Icon i) { if (i instanceof ImageIcon && ((ImageIcon) i).getDescription() != null) s.append(" icon=").append(((ImageIcon) i).getDescription().replaceAll(".*/", "")); }
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\n", " ") + "\""; }

  static void tree(Component c, Window w, int d) {
    if (!(c instanceof Container)) return;
    for (Component k : ((Container) c).getComponents()) {
      if (!k.isShowing()) continue;
      String ds = desc(k);
      Point pt = SwingUtilities.convertPoint(k.getParent(), k.getLocation(), w);
      boolean leafy = !ds.isEmpty() || k instanceof JTable;
      if (leafy) System.out.println("  " + "  ".repeat(Math.min(d, 8)) + k.getClass().getName() + " @" + pt.x + "," + pt.y + " " + k.getWidth() + "x" + k.getHeight() + ds);
      if (!(k instanceof JTable)) tree(k, w, d + 1);
    }
  }

  @SuppressWarnings("unchecked")
  static <T> List<T> all(Class<T> k) throws Exception {
    List<T> acc = new ArrayList<>();
    edt(() -> walk(top(), k, acc));
    return acc;
  }

  @SuppressWarnings("unchecked")
  static <T> void walk(Component c, Class<T> k, List<T> acc) {
    if (k.isInstance(c) && c.isShowing()) acc.add((T) c);
    if (c instanceof Container) for (Component x : ((Container) c).getComponents()) walk(x, k, acc);
  }

  // procura botão ou label (texto, tooltip ou ícone); texto exato ganha de "contém" (senão "X" pegaria "Próximo")
  static JComponent find(String arg) throws Exception {
    int nth = 1;
    if (arg.matches(".*#\\d+")) { nth = Integer.parseInt(arg.replaceAll(".*#", "")); arg = arg.replaceAll("#\\d+$", ""); }
    String want = arg.toLowerCase();
    List<JComponent> cs = new ArrayList<>();
    for (JComponent c : all(JComponent.class)) if (c instanceof AbstractButton || c instanceof JLabel) cs.add(c);
    if (nth == 1) for (JComponent c : cs) if (want.equalsIgnoreCase(String.valueOf(text(c)).trim())) return c;
    int seen = 0;
    for (JComponent c : cs) {
      StringBuilder s = new StringBuilder();
      icon(s, c instanceof AbstractButton ? ((AbstractButton) c).getIcon() : ((JLabel) c).getIcon());
      String hay = (text(c) + " " + c.getToolTipText() + " " + s).toLowerCase();
      if (hay.contains(want) && (c instanceof AbstractButton || c.getMouseListeners().length > 0) && ++seen == nth) return c;
    }
    return null;
  }

  static String text(JComponent c) { return c instanceof AbstractButton ? ((AbstractButton) c).getText() : ((JLabel) c).getText(); }

  // clique de mouse de verdade (press/release/click) no centro: alguns botões do jogo ignoram doClick
  static void click(String arg) throws Exception {
    JComponent c = find(arg);
    if (c == null) { System.out.println("  não encontrado: " + arg); return; }
    Point[] pt = new Point[1];
    edt(() -> pt[0] = SwingUtilities.convertPoint(c, c.getWidth() / 2, c.getHeight() / 2, top()));
    clickAt(pt[0].x, pt[0].y, 1);
  }

  static void until(String arg) throws Exception {
    for (long end = System.currentTimeMillis() + 180_000; System.currentTimeMillis() < end; Thread.sleep(500)) {
      if (find(arg) != null) return;
    }
    System.out.println("  timeout esperando: " + arg);
  }

  static void clickAt(int x, int y, int count) throws Exception {
    Component[] tgt = new Component[1];
    Point[] local = new Point[1];
    edt(() -> {
      Window w = top();
      Component c = SwingUtilities.getDeepestComponentAt(w, x, y);
      if (c == null) c = w;
      tgt[0] = c;
      local[0] = SwingUtilities.convertPoint(w, x, y, c);
    });
    Component c = tgt[0];
    Point pt = local[0];
    System.out.println("  alvo: " + c.getClass().getName() + desc(c));
    for (int i = 1; i <= count; i++) {
      long t = System.currentTimeMillis();
      int n = i;
      SwingUtilities.invokeLater(() -> {
        c.dispatchEvent(new MouseEvent(c, MouseEvent.MOUSE_PRESSED, t, InputEvent.BUTTON1_DOWN_MASK, pt.x, pt.y, n, false, MouseEvent.BUTTON1));
        c.dispatchEvent(new MouseEvent(c, MouseEvent.MOUSE_RELEASED, t, 0, pt.x, pt.y, n, false, MouseEvent.BUTTON1));
        c.dispatchEvent(new MouseEvent(c, MouseEvent.MOUSE_CLICKED, t, 0, pt.x, pt.y, n, false, MouseEvent.BUTTON1));
      });
    }
  }

  static void key(String name) throws Exception {
    int code = KeyEvent.class.getField("VK_" + name.toUpperCase()).getInt(null);
    SwingUtilities.invokeLater(() -> {
      Window w = top();
      Component c = w.getFocusOwner() != null ? w.getFocusOwner() : w;
      long t = System.currentTimeMillis();
      c.dispatchEvent(new KeyEvent(c, KeyEvent.KEY_PRESSED, t, 0, code, KeyEvent.CHAR_UNDEFINED));
      c.dispatchEvent(new KeyEvent(c, KeyEvent.KEY_RELEASED, t, 0, code, KeyEvent.CHAR_UNDEFINED));
    });
  }

  static JTextComponent textField(Container c) {
    Component f = KeyboardFocusManager.getCurrentKeyboardFocusManager().getFocusOwner();
    if (f instanceof JTextField) return (JTextComponent) f;
    for (Component k : c.getComponents()) {
      if (k instanceof JTextField && k.isShowing() && ((JTextField) k).isEditable() && ((JTextField) k).getText().isEmpty()) return (JTextComponent) k;
      if (k instanceof Container) { JTextComponent r = textField((Container) k); if (r != null) return r; }
    }
    return null;
  }

  static void shot(String name) throws Exception {
    BufferedImage[] img = new BufferedImage[1];
    edt(() -> {
      Window w = top();
      Container root = w instanceof RootPaneContainer ? ((RootPaneContainer) w).getRootPane() : w;
      img[0] = new BufferedImage(root.getWidth(), root.getHeight(), BufferedImage.TYPE_INT_RGB);
      Graphics2D g = img[0].createGraphics();
      root.paint(g);
      g.dispose();
    });
    ImageIO.write(img[0], "png", out.resolve(name + ".png").toFile());
    System.out.println("  salvo " + name + ".png " + img[0].getWidth() + "x" + img[0].getHeight());
  }
}
