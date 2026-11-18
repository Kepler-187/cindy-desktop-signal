using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using System.Web.Script.Serialization;
using System.Diagnostics;
using Forms=System.Windows.Forms;
public class Row {public string id,group,title;public bool pulse;}
public class Snapshot {public Row[] rows; public string note; public int scale,panelSize; public bool preview; public string openId;}
class Signal : Window {
 readonly Canvas face=new Canvas(); readonly Image[] lights=new Image[3];
 readonly string[] groups={"red","amber","green"}, labels={"需要处理","进行中","已完成"};
 readonly TextBlock heading=new TextBlock{Foreground=Brushes.White,FontSize=15,VerticalAlignment=VerticalAlignment.Center};
 readonly ScaleTransform panelScale=new ScaleTransform(); readonly Popup panel=new Popup(); readonly StackPanel list=new StackPanel();
 readonly DispatcherTimer dismissal=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(220)};
 readonly string save=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Cindy-DesktopSignal","position.txt");
 Snapshot state=new Snapshot{rows=new Row[0],note="正在同步"};
 int selected=-1; bool previewing,pinned,moved,pressed,suppress; Point start,origin;
 Image Art(string file,double x,double y,double width,double height){
  var pic=new Image{Source=new BitmapImage(new Uri(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,file))),Width=width,Height=height,Stretch=Stretch.Fill,IsHitTestVisible=false};
  Canvas.SetLeft(pic,x);Canvas.SetTop(pic,y);face.Children.Add(pic);return pic;
 }
 Signal(){
  WindowStyle=WindowStyle.None;AllowsTransparency=true;Background=Brushes.Transparent;ResizeMode=ResizeMode.NoResize;ShowInTaskbar=false;Topmost=true;ShowActivated=false;
  Width=184;Height=58;face.Width=184;face.Height=58;Content=new Viewbox{Child=face};face.Background=Brushes.Transparent;
  Art("body.png",0,0,Width,Height);
  double[] centers={390,903,1421}, cy={397,399,401};
  for(int i=0;i<3;i++){lights[i]=Art("lens"+i+".png",(centers[i]-238-12)*Width/1967,(cy[i]-238-88)*Height/622,476*Width/1967,476*Height/622);lights[i].Opacity=0;}
  var area=SystemParameters.WorkArea;Left=area.Right-Width-16;Top=area.Top+16;
  try{var xy=File.ReadAllLines(save);double x=int.Parse(xy[0]),y=int.Parse(xy[1]);if(x>=SystemParameters.VirtualScreenLeft&&x+Width<=SystemParameters.VirtualScreenLeft+SystemParameters.VirtualScreenWidth&&y>=SystemParameters.VirtualScreenTop&&y+Height<=SystemParameters.VirtualScreenTop+SystemParameters.VirtualScreenHeight){Left=x;Top=y;}}catch(Exception){}
  var scroll=new ScrollViewer{Content=list,MaxHeight=300,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};
  var header=new DockPanel{Margin=new Thickness(3,2,2,6)};
  var clear=new Button{Content="清空",Padding=new Thickness(8,2,8,2),ToolTip="清空三盏灯的当前提示",Cursor=Cursors.Hand};
  clear.Click+=(s,e)=>{Console.WriteLine("click "+Convert.ToBase64String(Encoding.UTF8.GetBytes("!clear")));Console.Out.Flush();Apply(new Snapshot{rows=new Row[0],note=""});};
  DockPanel.SetDock(clear,Dock.Right);header.Children.Add(clear);header.Children.Add(heading);
  var content=new StackPanel();content.Children.Add(header);content.Children.Add(scroll);
  var border=new Border{LayoutTransform=panelScale,Background=new SolidColorBrush(Color.FromRgb(39,38,35)),CornerRadius=new CornerRadius(9),Padding=new Thickness(12),Width=265,Child=content};
  panel.AllowsTransparency=true;panel.Child=border;panel.PlacementTarget=this;panel.Placement=PlacementMode.Bottom;panel.StaysOpen=true;
  dismissal.Tick+=(s,e)=>{dismissal.Stop();if(!previewing&&!pinned&&!face.IsMouseOver&&!border.IsMouseOver)HidePanel();};
  border.MouseEnter+=(s,e)=>dismissal.Stop();border.MouseLeave+=(s,e)=>dismissal.Start();
  face.MouseLeave+=(s,e)=>{suppress=false;dismissal.Start();};
  face.MouseMove+=(s,e)=>{
   var pt=e.GetPosition(face);int idx=Lens(pt);
   if(pressed){var mouse=face.PointToScreen(pt);var diff=mouse-start;
    if(moved||diff.Length>4){moved=true;HidePanel();var delta=PresentationSource.FromVisual(this).CompositionTarget.TransformFromDevice.Transform(diff);Left=origin.X+delta.X;Top=origin.Y+delta.Y;}return;}
   if(!pinned&&!suppress&&idx>=0){dismissal.Stop();ShowPanel(idx);}
   else if(idx<0&&!pinned){suppress=false;}
  };
  face.MouseLeftButtonDown+=(s,e)=>{pressed=true;moved=false;start=face.PointToScreen(e.GetPosition(face));origin=new Point(Left,Top);face.CaptureMouse();};
  face.MouseLeftButtonUp+=(s,e)=>{if(!pressed)return;pressed=false;face.ReleaseMouseCapture();
   if(moved){Snap();return;}int idx=Lens(e.GetPosition(face));if(idx<0)return;
   if(pinned&&selected==idx){HidePanel();suppress=true;}else{ShowPanel(idx);pinned=true;RenderList();}};
  ContentRendered+=(s,e)=>{var t=new Thread(Read);t.IsBackground=true;t.Start();Console.WriteLine("ready");Console.Out.Flush();};
 }
 int Lens(Point p){for(int i=0;i<3;i++)if(Math.Abs(p.X-new[]{35.3,83.1,131.9}[i])<=21&&Math.Abs(p.Y-29)<23)return i;return -1;}
 void Snap(){var screen=Forms.Screen.FromPoint(Forms.Cursor.Position).WorkingArea;var scale=PresentationSource.FromVisual(this).CompositionTarget.TransformFromDevice;
  var a=scale.Transform(new Point(screen.Left,screen.Top));var b=scale.Transform(new Point(screen.Right,screen.Bottom));
  if(Left<a.X+15)Left=a.X;else if(Left+Width>b.X-15)Left=b.X-Width;
  if(Top<a.Y+15)Top=a.Y;else if(Top+Height>b.Y-15)Top=b.Y-Height;
  try{Directory.CreateDirectory(Path.GetDirectoryName(save));File.WriteAllLines(save,new[]{((int)Left).ToString(),((int)Top).ToString()});}catch(IOException){}}
 void ShowPanel(int idx){if(selected==idx&&panel.IsOpen)return;selected=idx;RenderList();panel.IsOpen=true;}
 void HidePanel(){panel.IsOpen=false;pinned=false;selected=-1;}
 TextBlock Label(string value,int size){return new TextBlock{Text=value,FontSize=size,Foreground=Brushes.White,Margin=new Thickness(3,4,3,4),TextWrapping=TextWrapping.Wrap};}
 void RenderList(){if(selected<0)return;list.Children.Clear();var rows=state.rows.Where(r=>r.group==groups[selected]).ToArray();
  heading.Text=labels[selected]+"  ·  "+rows.Length+(pinned?"　已固定":"");
  if(!String.IsNullOrEmpty(state.note))list.Children.Add(Label(state.note,11));
  if(rows.Length==0)list.Children.Add(Label("当前没有这类任务",12));
  foreach(var r in rows){var row=r;var button=new Button{Content=Label(row.title,13),HorizontalContentAlignment=HorizontalAlignment.Left,Padding=new Thickness(4),Margin=new Thickness(0,2,0,0),Background=new SolidColorBrush(Color.FromRgb(61,60,56)),BorderThickness=new Thickness(0),Cursor=Cursors.Hand};
   button.Click+=(s,e)=>{HidePanel();suppress=true;
    BringCindyForward();
    Console.WriteLine("click "+Convert.ToBase64String(Encoding.UTF8.GetBytes(row.id)));Console.Out.Flush();};list.Children.Add(button);}
 }
 readonly int[] modes={-1,-1,-1};
 [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
 [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
 [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr hwnd,int cmd);
 void BringCindyForward(){
  var exe=Environment.GetEnvironmentVariable("SIGNAL_CINDY_EXE");if(String.IsNullOrEmpty(exe))return;
  foreach(var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(exe))){
   using(process){try{var hwnd=process.MainWindowHandle;if(hwnd==IntPtr.Zero||!String.Equals(exe,process.MainModule.FileName,StringComparison.OrdinalIgnoreCase))continue;
    if(IsIconic(hwnd))ShowWindowAsync(hwnd,9);SetForegroundWindow(hwnd);return;}catch(System.ComponentModel.Win32Exception){}catch(InvalidOperationException){}}
  }
 }
 void ResizeLamp(int percent){
  if(percent<50||percent>200)return;
  double w=184*percent/100.0,h=58*percent/100.0;if(Width==w&&Height==h)return;
  var screen=Forms.Screen.FromHandle(new System.Windows.Interop.WindowInteropHelper(this).Handle).WorkingArea;
  var transform=PresentationSource.FromVisual(this).CompositionTarget.TransformFromDevice;
  var a=transform.Transform(new Point(screen.Left,screen.Top));var b=transform.Transform(new Point(screen.Right,screen.Bottom));
  bool right=Math.Abs(Left+Width-b.X)<2,bottom=Math.Abs(Top+Height-b.Y)<2;
  Width=w;Height=h;Left=Math.Max(a.X,Math.Min(right?b.X-w:Left,b.X-w));Top=Math.Max(a.Y,Math.Min(bottom?b.Y-h:Top,b.Y-h));
 }
 void Apply(Snapshot next){
  if(!String.IsNullOrEmpty(next.openId)){
   try{Process.Start(new ProcessStartInfo("cindy://session/"+Uri.EscapeDataString(next.openId)){UseShellExecute=true});}
   catch(System.ComponentModel.Win32Exception){MessageBox.Show("无法打开 Cindy 任务");}return;
  }
  ResizeLamp(next.scale);
  if(next.panelSize>=50&&next.panelSize<=200)panelScale.ScaleX=panelScale.ScaleY=next.panelSize/100.0;
  bool wasPreview=previewing;previewing=next.preview;state=next;
  if(previewing&&!panel.IsOpen){
   int index=Array.FindIndex(groups,g=>next.rows.Any(r=>r.group==g));ShowPanel(index<0?1:index);
  }else if(wasPreview&&!previewing&&!pinned&&!face.IsMouseOver&&!panel.Child.IsMouseOver)HidePanel();
  for(int i=0;i<3;i++){
  var rows=state.rows.Where(r=>r.group==groups[i]).ToArray();
  int mode=rows.Any(r=>r.pulse)?2:rows.Length>0?1:0;if(mode==modes[i])continue;modes[i]=mode;
  lights[i].BeginAnimation(OpacityProperty,null);lights[i].Opacity=mode==0?0:1;
  if(mode==2)lights[i].BeginAnimation(OpacityProperty,new DoubleAnimation(1,.77,TimeSpan.FromSeconds(2.1)){AutoReverse=true,RepeatBehavior=RepeatBehavior.Forever,EasingFunction=new SineEase{EasingMode=EasingMode.EaseInOut}});
 }if(panel.IsOpen)RenderList();}
 void Read(){var json=new JavaScriptSerializer{MaxJsonLength=Int32.MaxValue};string line;while((line=Console.ReadLine())!=null){var data=json.Deserialize<Snapshot>(line);Dispatcher.Invoke(new Action(()=>Apply(data)));}Dispatcher.Invoke(new Action(Close));}
 [STAThread]static void Main(){Console.SetIn(new StreamReader(Console.OpenStandardInput(),Encoding.UTF8));new Application().Run(new Signal());}
}



