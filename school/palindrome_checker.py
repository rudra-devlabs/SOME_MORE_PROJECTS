num = int(input("Enter the number to check: "))
reverse = int(str(num)[::-1])
if (reverse == num):
    print("It is a palindrome!!!")
else:
    print("Not a palindrome!!!")