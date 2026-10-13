import java.io.*; import java.lang.reflect.*; import java.util.*;
// Deserializes Brasfoot data files and emits JSON using public getters (field names are obfuscated).
public class Dump {
  static String q(String s){StringBuilder b=new StringBuilder("\"");for(char c:s.toCharArray()){if(c=='"'||c=='\\')b.append('\\').append(c);else if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);}return b.append('"').toString();}
  static void w(Object o, StringBuilder sb, int depth){
    if(o==null){sb.append("null");return;}
    if(depth>12){sb.append("\"<deep>\"");return;}
    if(o instanceof String) {sb.append(q((String)o));return;}
    if(o instanceof Number||o instanceof Boolean){sb.append(o);return;}
    if(o instanceof Character){sb.append(q(o.toString()));return;}
    if(o instanceof java.awt.Color){java.awt.Color c=(java.awt.Color)o;sb.append(q(String.format("#%02x%02x%02x",c.getRed(),c.getGreen(),c.getBlue())));return;}
    if(o instanceof Collection){sb.append('[');boolean f=true;for(Object x:(Collection)o){if(!f)sb.append(',');f=false;w(x,sb,depth+1);}sb.append(']');return;}
    if(o instanceof Map){sb.append('{');boolean f=true;for(Object e:((Map)o).entrySet()){Map.Entry en=(Map.Entry)e;if(!f)sb.append(',');f=false;sb.append(q(String.valueOf(en.getKey()))).append(':');w(en.getValue(),sb,depth+1);}sb.append('}');return;}
    if(o.getClass().isArray()){sb.append('[');int n=Array.getLength(o);for(int i=0;i<n;i++){if(i>0)sb.append(',');w(Array.get(o,i),sb,depth+1);}sb.append(']');return;}
    if(o instanceof Enum){sb.append(q(o.toString()));return;}
    sb.append("{\"_class\":").append(q(o.getClass().getName()));
    TreeMap<String,Method> gs=new TreeMap<>();
    for(Method m:o.getClass().getMethods()){
      if(m.getParameterCount()!=0||m.getDeclaringClass()==Object.class||Modifier.isStatic(m.getModifiers()))continue;
      String n=m.getName(); String k=null;
      if(n.startsWith("get")&&n.length()>3)k=n.substring(3); else if(n.startsWith("is")&&n.length()>2)k=n.substring(2);
      if(k!=null&&!k.equals("Class"))gs.put(k,m);
    }
    for(Map.Entry<String,Method> e:gs.entrySet()){
      Object v; try{v=e.getValue().invoke(o);}catch(Throwable t){continue;}
      if(v instanceof File||v instanceof java.awt.Image||v instanceof javax.swing.Icon)continue;
      sb.append(',').append(q(e.getKey())).append(':'); w(v,sb,depth+1);
    }
    // also raw declared fields so nothing is lost
    sb.append(",\"_f\":{"); boolean f=true;
    for(Class<?> c=o.getClass();c!=null&&c!=Object.class;c=c.getSuperclass())for(Field fl:c.getDeclaredFields()){
      int md=fl.getModifiers(); if(Modifier.isStatic(md)||Modifier.isTransient(md))continue;
      try{fl.setAccessible(true);Object v=fl.get(o); if(v!=null&&!Modifier.isPublic(md)&&!(v instanceof String||v instanceof Number||v instanceof Boolean||v instanceof Character))continue;
        if(!f)sb.append(',');f=false;sb.append(q(fl.getName())).append(':');w(v,sb,depth+1);}catch(Throwable t){}
    }
    sb.append("}}");
  }
  public static void main(String[] a) throws Exception{
    for(String p:a){ try(ObjectInputStream in=new ObjectInputStream(new BufferedInputStream(new FileInputStream(p)))){
      Object o=in.readObject(); StringBuilder sb=new StringBuilder(); w(o,sb,0); System.out.println(sb);
    }catch(Throwable t){System.err.println(p+": "+t);} }
  }
}
